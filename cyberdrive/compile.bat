@echo off
echo Searching for VS Dev Tools...

set "DEVCMD=D:\c++\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=C:\Program Files (x86)\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=C:\Program Files\Microsoft Visual Studio\2019\Community\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=D:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=D:\Program Files (x86)\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

set "DEVCMD=D:\Program Files\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
if exist "%DEVCMD%" goto compile

echo Error: VsDevCmd.bat not found in common locations.
exit /b 1

:compile
echo Found DevCmd: "%DEVCMD%"
call "%DEVCMD%" >nul
echo Compiling server.c...
cl.exe /O2 server.c
if %errorlevel% equ 0 (
    echo Compilation successful! server.exe created.
) else (
    echo Compilation failed.
)
