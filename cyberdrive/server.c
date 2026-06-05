#define _CRT_SECURE_NO_WARNINGS 1
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#pragma comment(lib, "ws2_32.lib")

#define PORT 8080
#define BUFFER_SIZE 8192
#define MAX_JSON_SIZE 65536

// URL Decoding utility (converts %20 to space, etc.)
void url_decode(const char* src, char* dest) {
    const char* p = src;
    char* d = dest;
    while (*p) {
        if (*p == '%' && p[1] && p[2]) {
            char hex[3] = { p[1], p[2], '\0' };
            *d++ = (char)strtol(hex, NULL, 16);
            p += 3;
        } else if (*p == '+') {
            *d++ = ' ';
            p++;
        } else {
            *d++ = *p++;
        }
    }
    *d = '\0';
}

// Extractor helper for query parameters (e.g. ?name=test.txt)
void get_query_param(const char* path, const char* param_name, char* dest, int max_len) {
    char search_pattern[64];
    sprintf(search_pattern, "%s=", param_name);
    
    const char* found = strstr(path, search_pattern);
    if (!found) {
        dest[0] = '\0';
        return;
    }
    
    found += strlen(search_pattern);
    
    char temp[512];
    int i = 0;
    while (found[i] && found[i] != '&' && found[i] != ' ' && i < 511) {
        temp[i] = found[i];
        i++;
    }
    if (i >= max_len - 1) i = max_len - 2; // Enforce caller's buffer limit
    temp[i] = '\0';
    
    url_decode(temp, dest);
    // Enforce max_len on decoded output as well
    dest[max_len - 1] = '\0';
}

// Get Content-Type MIME description based on file extension
const char* get_content_type(const char* filepath) {
    const char* ext = strrchr(filepath, '.');
    if (!ext) return "application/octet-stream";
    
    if (_stricmp(ext, ".html") == 0 || _stricmp(ext, ".htm") == 0) return "text/html; charset=utf-8";
    if (_stricmp(ext, ".css") == 0) return "text/css";
    if (_stricmp(ext, ".js") == 0) return "application/javascript";
    if (_stricmp(ext, ".png") == 0) return "image/png";
    if (_stricmp(ext, ".jpg") == 0 || _stricmp(ext, ".jpeg") == 0) return "image/jpeg";
    if (_stricmp(ext, ".gif") == 0) return "image/gif";
    if (_stricmp(ext, ".mp3") == 0) return "audio/mpeg";
    if (_stricmp(ext, ".mp4") == 0) return "video/mp4";
    if (_stricmp(ext, ".txt") == 0 || _stricmp(ext, ".md") == 0) return "text/plain; charset=utf-8";
    if (_stricmp(ext, ".json") == 0) return "application/json";
    
    return "application/octet-stream";
}

// Security: Validate filename to prevent path traversal attacks
int is_safe_filename(const char* name) {
    if (!name || name[0] == '\0') return 0;
    if (strstr(name, "..") != NULL) return 0;
    if (strchr(name, '/') != NULL) return 0;
    if (strchr(name, '\\') != NULL) return 0;
    if (name[0] == '~') return 0;
    return 1;
}

// Read storage directory and compile files inside into a JSON response
void get_files_json(char* buffer, int max_len) {
    WIN32_FIND_DATAA find_data;
    HANDLE hFind = FindFirstFileA("storage\\*", &find_data);
    
    strcpy(buffer, "[");
    int first = 1;
    
    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            // Ignore system links '.' and '..'
            if (strcmp(find_data.cFileName, ".") == 0 || strcmp(find_data.cFileName, "..") == 0) {
                continue;
            }
            
            ULARGE_INTEGER file_size;
            file_size.LowPart = find_data.nFileSizeLow;
            file_size.HighPart = find_data.nFileSizeHigh;
            
            char file_item[512];
            // Format item JSON: {"name": "filename", "size": bytes}
            sprintf(file_item, "%s{\"name\":\"%s\",\"size\":%lld}", 
                    first ? "" : ",", 
                    find_data.cFileName, 
                    (long long)file_size.QuadPart);
            
            if (strlen(buffer) + strlen(file_item) + 2 < (size_t)max_len) {
                strcat(buffer, file_item);
                first = 0;
            } else {
                break; // Buffer ceiling hit
            }
        } while (FindNextFileA(hFind, &find_data));
        FindClose(hFind);
    }
    strcat(buffer, "]");
}

// Simple text reply helper
void send_text_response(SOCKET client, const char* status, const char* content_type, const char* body) {
    char header[512];
    sprintf(header, 
            "HTTP/1.1 %s\r\n"
            "Content-Type: %s\r\n"
            "Content-Length: %d\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Connection: close\r\n\r\n", 
            status, content_type, (int)strlen(body));
            
    send(client, header, (int)strlen(header), 0);
    send(client, body, (int)strlen(body), 0);
}

// Chunked File Streaming helper (enables media seeking and HTML loads)
void send_file_response(SOCKET client, const char* filepath) {
    FILE* file = fopen(filepath, "rb");
    if (!file) {
        send_text_response(client, "404 Not Found", "text/plain", "File not found on server.");
        return;
    }
    
    // Find file size
    fseek(file, 0, SEEK_END);
    long long filesize = _ftelli64(file);
    fseek(file, 0, SEEK_SET);
    
    // Send headers
    char header[512];
    sprintf(header, 
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: %s\r\n"
            "Content-Length: %lld\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Accept-Ranges: bytes\r\n"
            "Connection: close\r\n\r\n", 
            get_content_type(filepath), filesize);
            
    send(client, header, (int)strlen(header), 0);
    
    // Stream data buffer
    char* file_buf = malloc(BUFFER_SIZE);
    if (!file_buf) {
        fclose(file);
        return;
    }

    size_t bytes_read;
    while ((bytes_read = fread(file_buf, 1, BUFFER_SIZE, file)) > 0) {
        send(client, file_buf, (int)bytes_read, 0);
    }
    
    free(file_buf);
    fclose(file);
}

int main() {
    // 1. Initialize Windows Sockets
    WSADATA wsa_data;
    if (WSAStartup(MAKEWORD(2, 2), &wsa_data) != 0) {
        printf("Winsock Init Failed!\n");
        return 1;
    }
    
    // Create folders
    CreateDirectoryA("storage", NULL);
    CreateDirectoryA("web", NULL);
    
    // 2. Establish server socket
    SOCKET server_fd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (server_fd == INVALID_SOCKET) {
        printf("Socket Creation Failed: %d\n", WSAGetLastError());
        WSACleanup();
        return 1;
    }
    
    // Set socket options to reuse address
    char opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    
    struct sockaddr_in address;
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY; // Listen on all network adapters
    address.sin_port = htons(PORT);
    
    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) == SOCKET_ERROR) {
        printf("Socket Bind Failed: %d\n", WSAGetLastError());
        closesocket(server_fd);
        WSACleanup();
        return 1;
    }
    
    if (listen(server_fd, SOMAXCONN) == SOCKET_ERROR) {
        printf("Socket Listen Failed: %d\n", WSAGetLastError());
        closesocket(server_fd);
        WSACleanup();
        return 1;
    }
    
    printf("\n=========================================================\n");
    printf("   CyberDrive Web 云盘服务端正在运行...\n");
    printf("   本机地址: http://localhost:%d\n", PORT);
    printf("   局域网共享: 请在手机浏览器中输入 http://[你电脑的局域网IP]:%d\n", PORT);
    printf("=========================================================\n\n");
    
    char* request_buffer = malloc(BUFFER_SIZE);
    if (!request_buffer) {
        closesocket(server_fd);
        WSACleanup();
        return 1;
    }

    // 3. HTTP Request Acceptance loop
    while (1) {
        SOCKET client_socket = accept(server_fd, NULL, NULL);
        if (client_socket == INVALID_SOCKET) {
            continue;
        }
        
        memset(request_buffer, 0, BUFFER_SIZE);
        int bytes_received = recv(client_socket, request_buffer, BUFFER_SIZE - 1, 0);
        if (bytes_received <= 0) {
            closesocket(client_socket);
            continue;
        }
        
        // Parse request line (Method, Path)
        char method[16] = {0};
        char full_path[1024] = {0};
        sscanf(request_buffer, "%15s %1023s", method, full_path);
        
        // Isolate base path from query string
        char path[1024] = {0};
        char* query_ptr = strchr(full_path, '?');
        if (query_ptr) {
            int len = (int)(query_ptr - full_path);
            strncpy(path, full_path, len < 1023 ? len : 1023);
        } else {
            strcpy(path, full_path);
        }
        
        // --- ROUTE: GET ---
        if (_stricmp(method, "GET") == 0) {
            if (strcmp(path, "/") == 0 || strcmp(path, "/index.html") == 0) {
                send_file_response(client_socket, "web/index.html");
            } else if (strcmp(path, "/style.css") == 0) {
                send_file_response(client_socket, "web/style.css");
            } else if (strcmp(path, "/app.js") == 0) {
                send_file_response(client_socket, "web/app.js");
            } else if (strcmp(path, "/api/files") == 0) {
                char* files_json = malloc(MAX_JSON_SIZE);
                if (files_json) {
                    get_files_json(files_json, MAX_JSON_SIZE);
                    send_text_response(client_socket, "200 OK", "application/json", files_json);
                    free(files_json);
                } else {
                    send_text_response(client_socket, "500 Internal Server Error", "text/plain", "Out of memory");
                }
            } else if (strncmp(path, "/storage/", 9) == 0) {
                // Decode file name and map to local path
                char raw_filename[512] = {0};
                char decoded_filename[512] = {0};
                url_decode(path + 9, raw_filename);
                
                if (!is_safe_filename(raw_filename)) {
                    send_text_response(client_socket, "403 Forbidden", "text/plain", "Invalid filename.");
                    closesocket(client_socket);
                    continue;
                }
                
                char local_path[1024];
                sprintf(local_path, "storage\\%s", raw_filename);
                
                send_file_response(client_socket, local_path);
            } else {
                send_text_response(client_socket, "404 Not Found", "text/plain", "Route not found.");
            }
        }
        // --- ROUTE: POST ---
        else if (_stricmp(method, "POST") == 0) {
            // 1. File Uploading handler
            if (strcmp(path, "/api/upload") == 0) {
                char filename[512] = {0};
                get_query_param(full_path, "name", filename, 511);
                
                if (strlen(filename) == 0 || !is_safe_filename(filename)) {
                    send_text_response(client_socket, "400 Bad Request", "application/json", "{\"success\":false,\"error\":\"Invalid or missing filename\"}");
                    closesocket(client_socket);
                    continue;
                }
                
                // Get Content-Length
                long long content_length = 0;
                const char* cl_header = strstr(request_buffer, "Content-Length:");
                if (cl_header) {
                    sscanf(cl_header, "Content-Length: %lld", &content_length);
                }
                
                // Locate end of HTTP header \r\n\r\n
                const char* header_end = strstr(request_buffer, "\r\n\r\n");
                int body_start_offset = 0;
                if (header_end) {
                    header_end += 4;
                    body_start_offset = (int)(header_end - request_buffer);
                }
                
                char local_filepath[1024];
                sprintf(local_filepath, "storage\\%s", filename);
                FILE* upload_file = fopen(local_filepath, "wb");
                
                if (!upload_file) {
                    send_text_response(client_socket, "500 Internal Server Error", "application/json", "{\"success\":false,\"error\":\"Failed to create file\"}");
                    closesocket(client_socket);
                    continue;
                }
                
                // Write initial payload already read in recv buffer
                int bytes_in_buffer = bytes_received - body_start_offset;
                long long total_written = 0;
                if (bytes_in_buffer > 0 && body_start_offset > 0) {
                    long long to_write = (bytes_in_buffer < content_length) ? bytes_in_buffer : content_length;
                    fwrite(header_end, 1, (size_t)to_write, upload_file);
                    total_written += to_write;
                }
                
                // Stream remaining network chunks to file on disk
                char* stream_buf = malloc(BUFFER_SIZE);
                if (stream_buf) {
                    while (total_written < content_length) {
                        int chunk = recv(client_socket, stream_buf, BUFFER_SIZE, 0);
                        if (chunk <= 0) break;
                        
                        long long to_write = (chunk < (content_length - total_written)) ? chunk : (content_length - total_written);
                        fwrite(stream_buf, 1, (size_t)to_write, upload_file);
                        total_written += to_write;
                    }
                    free(stream_buf);
                }
                
                fclose(upload_file);
                printf("Uploaded file: %s (%lld bytes)\n", filename, total_written);
                send_text_response(client_socket, "200 OK", "application/json", "{\"success\":true}");
            }
            // 2. File Deleting handler
            else if (strcmp(path, "/api/delete") == 0) {
                char filename[512] = {0};
                get_query_param(full_path, "name", filename, 511);
                
                if (strlen(filename) == 0 || !is_safe_filename(filename)) {
                    send_text_response(client_socket, "400 Bad Request", "application/json", "{\"success\":false,\"error\":\"Invalid or missing filename\"}");
                    closesocket(client_socket);
                    continue;
                }
                
                char local_filepath[1024];
                sprintf(local_filepath, "storage\\%s", filename);
                
                if (DeleteFileA(local_filepath)) {
                    printf("Deleted file: %s\n", filename);
                    send_text_response(client_socket, "200 OK", "application/json", "{\"success\":true}");
                } else {
                    send_text_response(client_socket, "500 Internal Error", "application/json", "{\"success\":false,\"error\":\"Could not delete file\"}");
                }
            }
            // 3. Save Text Editor content back to server
            else if (strcmp(path, "/api/save") == 0) {
                char filename[512] = {0};
                get_query_param(full_path, "name", filename, 511);
                
                if (strlen(filename) == 0 || !is_safe_filename(filename)) {
                    send_text_response(client_socket, "400 Bad Request", "application/json", "{\"success\":false}");
                    closesocket(client_socket);
                    continue;
                }
                
                long long content_length = 0;
                const char* cl_header = strstr(request_buffer, "Content-Length:");
                if (cl_header) {
                    sscanf(cl_header, "Content-Length: %lld", &content_length);
                }
                
                const char* header_end = strstr(request_buffer, "\r\n\r\n");
                int body_start_offset = 0;
                if (header_end) {
                    header_end += 4;
                    body_start_offset = (int)(header_end - request_buffer);
                }
                
                char local_filepath[1024];
                sprintf(local_filepath, "storage\\%s", filename);
                FILE* save_file = fopen(local_filepath, "wb");
                
                if (!save_file) {
                    send_text_response(client_socket, "500 Internal Error", "application/json", "{\"success\":false}");
                    closesocket(client_socket);
                    continue;
                }
                
                int bytes_in_buffer = bytes_received - body_start_offset;
                long long total_written = 0;
                if (bytes_in_buffer > 0 && body_start_offset > 0) {
                    long long to_write = (bytes_in_buffer < content_length) ? bytes_in_buffer : content_length;
                    fwrite(header_end, 1, (size_t)to_write, save_file);
                    total_written += to_write;
                }
                
                char* stream_buf = malloc(BUFFER_SIZE);
                if (stream_buf) {
                    while (total_written < content_length) {
                        int chunk = recv(client_socket, stream_buf, BUFFER_SIZE, 0);
                        if (chunk <= 0) break;
                        
                        long long to_write = (chunk < (content_length - total_written)) ? chunk : (content_length - total_written);
                        fwrite(stream_buf, 1, (size_t)to_write, save_file);
                        total_written += to_write;
                    }
                    free(stream_buf);
                }
                fclose(save_file);
                printf("Saved text file changes: %s\n", filename);
                send_text_response(client_socket, "200 OK", "application/json", "{\"success\":true}");
            }
            else {
                send_text_response(client_socket, "404 Not Found", "text/plain", "Route not found.");
            }
        }
        else {
            send_text_response(client_socket, "501 Not Implemented", "text/plain", "Method not supported.");
        }
        
        closesocket(client_socket);
    }
    
    free(request_buffer);
    closesocket(server_fd);
    WSACleanup();
    return 0;
}
