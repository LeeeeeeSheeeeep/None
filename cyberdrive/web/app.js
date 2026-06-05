// CyberDrive Web Client Controller
document.addEventListener('DOMContentLoaded', () => {
  // 1. Elements Selection
  const btnRefresh = document.getElementById('btn-refresh');
  const filesGrid = document.getElementById('files-grid');
  
  const statFileCount = document.getElementById('stat-file-count');
  const statStorageSize = document.getElementById('stat-storage-size');
  const storageProgress = document.getElementById('storage-progress');
  const serverAddressDisplay = document.getElementById('server-address-display');
  
  const searchInput = document.getElementById('search-input');
  
  const dropZone = document.getElementById('drop-zone');
  const fileUploader = document.getElementById('file-uploader');
  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  
  const uploadProgressOverlay = document.getElementById('upload-progress-container');
  const uploadProgressFill = document.getElementById('upload-progress-fill');
  const uploadProgressText = document.getElementById('upload-progress-text');
  
  // Modals & Drawers
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  
  const mediaDrawer = document.getElementById('media-drawer');
  const mediaDrawerTitle = document.getElementById('media-drawer-title');
  const mediaVideo = document.getElementById('media-video');
  const mediaAudio = document.getElementById('media-audio');
  const btnCloseMedia = document.getElementById('btn-close-media');
  
  const editorModal = document.getElementById('editor-modal');
  const editorFilename = document.getElementById('editor-filename');
  const textEditorTextarea = document.getElementById('text-editor-textarea');
  const btnSaveEditor = document.getElementById('btn-save-editor');
  const btnCloseEditor = document.getElementById('btn-close-editor');

  let allFiles = []; // Cache file list
  let currentEditingFilename = '';

  // Set Address Display to current URL
  serverAddressDisplay.innerHTML = `<span>服务器地址: http://${window.location.host}</span>`;

  // 2. Fetch File List API
  async function fetchFiles() {
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('API server returned error');
      
      allFiles = await res.json();
      renderFilesGrid(allFiles);
      updateStats(allFiles);
    } catch (err) {
      console.error(err);
      filesGrid.innerHTML = `
        <div class="empty-state">
          <p style="color: var(--neon-red);">无法连接到云盘服务器，请确认 C 语言后台服务已启动！</p>
        </div>
      `;
    }
  }

  // Formatting utility for file sizes
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Update Left Panel Diagnostic Stats
  function updateStats(files) {
    statFileCount.textContent = `${files.length} 个文件`;
    
    // Count total bytes size
    const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
    statStorageSize.textContent = `已用: ${formatBytes(totalBytes)}`;
    
    // Progress calculation (arbitrary threshold of 100MB for progress bar representation)
    const capLimit = 100 * 1024 * 1024; // 100MB
    const pct = Math.min(100, Math.round((totalBytes / capLimit) * 100));
    storageProgress.style.width = pct + '%';
  }

  // Classify file extension for icon & color glowing
  function getFileClassification(name) {
    const ext = name.split('.').pop().toLowerCase();
    
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
    const videoExtensions = ['mp4', 'webm', 'avi', 'mkv', 'mov'];
    const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    const codeExtensions = ['txt', 'md', 'json', 'js', 'css', 'html', 'c', 'cpp', 'h', 'py', 'java', 'xml'];
    
    if (imageExtensions.includes(ext)) {
      return { class: 'img', icon: '🖼️' };
    }
    if (videoExtensions.includes(ext)) {
      return { class: 'video', icon: '🎬' };
    }
    if (audioExtensions.includes(ext)) {
      return { class: 'audio', icon: '🎵' };
    }
    if (codeExtensions.includes(ext)) {
      return { class: 'code', icon: '📝' };
    }
    
    return { class: 'other', icon: '📦' };
  }

  // Render Files Cards
  function renderFilesGrid(files) {
    filesGrid.innerHTML = '';
    
    if (files.length === 0) {
      filesGrid.innerHTML = `
        <div class="empty-state">
          <p>云盘当前为空，拖拽或选择文件上传，开启你的极速局域网传输之旅！</p>
        </div>
      `;
      return;
    }

    files.forEach(file => {
      const type = getFileClassification(file.name);
      const card = document.createElement('div');
      card.className = `file-card ${type.class}`;
      
      card.innerHTML = `
        <div class="file-info-row">
          <div class="file-type-icon">${type.icon}</div>
          <div class="file-meta">
            <h3 class="file-name" title="${file.name}">${file.name}</h3>
            <span class="file-size">${formatBytes(file.size)}</span>
          </div>
        </div>
        <div class="file-actions">
          ${type.class === 'code' ? `<button class="btn btn-card-action btn-edit" data-name="${file.name}">✏️ 编辑</button>` : ''}
          <a href="/storage/${encodeURIComponent(file.name)}" download class="btn btn-card-action" style="text-decoration:none;">💾 下载</a>
          <button class="btn btn-card-action btn-delete" data-name="${file.name}">🗑️ 删除</button>
        </div>
      `;
      
      // Card click triggers lightbox/drawer preview (not including action buttons)
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) {
          return; // Skip if actions clicked
        }
        triggerFilePreview(file.name, type.class);
      });

      // Bind Deletion button
      card.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFile(file.name);
      });

      // Bind Edit button (if exists)
      const editBtn = card.querySelector('.btn-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openTextEditor(file.name);
        });
      }

      filesGrid.appendChild(card);
    });
  }

  // Search filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = allFiles.filter(file => file.name.toLowerCase().includes(query));
    renderFilesGrid(filtered);
  });

  // 3. Delete File API
  async function deleteFile(name) {
    if (!confirm(`确定要彻底删除文件 [${name}] 吗？`)) return;

    try {
      const res = await fetch(`/api/delete?name=${encodeURIComponent(name)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        fetchFiles();
      } else {
        alert('删除失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      console.error(err);
      alert('无法删除文件，请检查网络！');
    }
  }

  // 4. File Upload (using XHR to track stream progress)

  // Trigger file uploads sequentially
  function handleFilesUpload(filesList) {
    if (filesList.length === 0) return;
    
    // For simplicity, upload the first file, then chain or upload single. 
    // We'll upload files one by one to keep the progress bar clean.
    let index = 0;
    
    function startNext() {
      if (index >= filesList.length) return;
      const file = filesList[index];
      
      uploadProgressOverlay.style.display = 'flex';
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}`, true);
      
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          uploadProgressFill.style.width = pct + '%';
          uploadProgressText.textContent = `正在传输 [${index + 1}/${filesList.length}] ${file.name}... ${pct}%`;
        }
      };
      
      xhr.onload = function() {
        if (xhr.status === 200) {
          index++;
          if (index < filesList.length) {
            startNext();
          } else {
            uploadProgressOverlay.style.display = 'none';
            fetchFiles();
          }
        } else {
          uploadProgressOverlay.style.display = 'none';
          alert('文件上传失败: ' + file.name);
          fetchFiles();
        }
      };
      
      xhr.onerror = function() {
        uploadProgressOverlay.style.display = 'none';
        alert('网络传输失败！');
        fetchFiles();
      };
      
      xhr.send(file);
    }
    
    startNext();
  }

  // Upload actions trigger
  btnTriggerUpload.addEventListener('click', () => fileUploader.click());
  fileUploader.addEventListener('change', () => {
    if (fileUploader.files.length > 0) {
      handleFilesUpload(fileUploader.files);
    }
  });

  // Drag and drop setup
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  });

  // 5. File Preview Triggers
  function triggerFilePreview(filename, typeClass) {
    const fileUrl = `/storage/${encodeURIComponent(filename)}`;
    
    // Stop active audio/video players if any
    closeMediaPlayer();

    if (typeClass === 'img') {
      lightboxImg.src = fileUrl;
      lightboxTitle.textContent = filename;
      lightboxModal.style.display = 'flex';
    } 
    else if (typeClass === 'video') {
      mediaVideo.src = fileUrl;
      mediaVideo.style.display = 'block';
      mediaAudio.style.display = 'none';
      mediaDrawerTitle.textContent = `播放视频: ${filename}`;
      mediaDrawer.classList.add('active');
      mediaVideo.play();
    } 
    else if (typeClass === 'audio') {
      mediaAudio.src = fileUrl;
      mediaAudio.style.display = 'block';
      mediaVideo.style.display = 'none';
      mediaDrawerTitle.textContent = `播放音频: ${filename}`;
      mediaDrawer.classList.add('active');
      mediaAudio.play();
    } 
    else if (typeClass === 'code') {
      openTextEditor(filename);
    }
  }

  // Lightbox close
  btnCloseLightbox.addEventListener('click', () => {
    lightboxModal.style.display = 'none';
    lightboxImg.src = '';
  });

  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
      lightboxModal.style.display = 'none';
      lightboxImg.src = '';
    }
  });

  // Close media drawers
  function closeMediaPlayer() {
    mediaVideo.pause();
    mediaAudio.pause();
    mediaVideo.src = '';
    mediaAudio.src = '';
    mediaDrawer.classList.remove('active');
  }
  btnCloseMedia.addEventListener('click', closeMediaPlayer);

  // 6. Text Editor Modal Actions
  async function openTextEditor(filename) {
    currentEditingFilename = filename;
    editorFilename.textContent = `编辑文本文件: ${filename}`;
    textEditorTextarea.value = '正在从服务器加载内容...';
    editorModal.style.display = 'flex';
    
    try {
      const res = await fetch(`/storage/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error('File read failed');
      const text = await res.text();
      textEditorTextarea.value = text;
    } catch (err) {
      console.error(err);
      textEditorTextarea.value = '错误: 无法从服务器加载文件。';
    }
  }

  // Save edits back to server
  btnSaveEditor.addEventListener('click', async () => {
    const textContent = textEditorTextarea.value;
    btnSaveEditor.textContent = '💾 正在保存...';
    btnSaveEditor.disabled = true;
    
    try {
      const res = await fetch(`/api/save?name=${encodeURIComponent(currentEditingFilename)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        },
        body: textContent
      });
      const data = await res.json();
      if (data.success) {
        btnSaveEditor.textContent = '💾 保存成功！';
        setTimeout(() => {
          btnSaveEditor.textContent = '💾 保存更改';
          btnSaveEditor.disabled = false;
        }, 1500);
        fetchFiles();
      } else {
        alert('文件保存失败！');
        btnSaveEditor.textContent = '💾 保存更改';
        btnSaveEditor.disabled = false;
      }
    } catch (err) {
      console.error(err);
      alert('保存过程网络中断！');
      btnSaveEditor.textContent = '💾 保存更改';
      btnSaveEditor.disabled = false;
    }
  });

  // Close text editor
  function closeTextEditor() {
    editorModal.style.display = 'none';
    textEditorTextarea.value = '';
    currentEditingFilename = '';
  }
  btnCloseEditor.addEventListener('click', closeTextEditor);
  textEditorTextarea.addEventListener('keydown', (e) => {
    // Save on Ctrl+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      btnSaveEditor.click();
    }
  });

  // Refresh trigger
  btnRefresh.addEventListener('click', () => {
    btnRefresh.textContent = '🔄 刷新中...';
    fetchFiles().then(() => {
      setTimeout(() => btnRefresh.textContent = '🔄 刷新', 500);
    });
  });

  // Startup load
  fetchFiles();
});
