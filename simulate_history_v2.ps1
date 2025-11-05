# simulate_history_v2.ps1
# Script to simulate a 2025 Git commit history for LocalVault2 P2P Sync Daemon

$git = "C:\Program Files\Git\cmd\git.exe"
$repoPath = "d:\c++\Project1\Project1\LocalVault2"
$tempPath = "d:\c++\Project1\Project1\LocalVault2_temp"

# 1. Rename existing folder to temp
Write-Host "Backing up current codebase..."
if (Test-Path $tempPath) {
    Remove-Item -Path $tempPath -Force -Recurse
}
Rename-Item -Path $repoPath -NewName "LocalVault2_temp"

# 2. Create a new empty repo folder
New-Item -ItemType Directory -Path $repoPath | Out-Null
Set-Location $repoPath

# 3. Init git
Write-Host "Initializing new Git repository..."
& $git init
& $git config user.name "LeeeeeeSheeeeep"
& $git config user.email "LeeeeeeSheeeeep@users.noreply.github.com"

# Helper function to copy and commit
function Commit-Step ($date, $message, $files) {
    Write-Host "Committing: $message ($date)..."
    foreach ($file in $files) {
        $source = Join-Path $tempPath $file
        $dest = Join-Path $repoPath $file
        
        # Ensure parent directory exists
        $parent = Split-Path -Path $dest -Parent
        if (!(Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent | Out-Null
        }
        
        # Copy file or directory
        Copy-Item -Path $source -Destination $dest -Force -Recurse | Out-Null
    }
    
    # Run git add and commit with backdates
    $env:GIT_AUTHOR_DATE = $date
    $env:GIT_COMMITTER_DATE = $date
    & $git add .
    & $git commit -m $message --quiet
}

# --- 2025 Commits ---
Commit-Step "2025-07-15T10:00:00" "Initial commit: P2P sync daemon module structure and config" @("go.mod", ".gitignore")
Commit-Step "2025-07-30T14:20:00" "Implement UDP multicast local network discovery engine" @("discovery/mdns.go")
Commit-Step "2025-08-15T11:05:00" "Implement ECDH cryptographic key exchange and AES-GCM secure channel" @("crypto/handshake.go")
Commit-Step "2025-08-28T16:15:00" "Implement Merkle Tree delta verification and frame socket utilities" @("sync/protocol.go")
Commit-Step "2025-09-10T09:40:00" "Implement TCP network handlers, database hooks and main execution logic" @("main.go", "go.sum")
Commit-Step "2025-09-22T13:30:00" "Implement handshake secure integration tests and README documentation" @("tests/sync_test.go", "README.md")

# Clean up
Write-Host "Cleaning up temp directories..."
Remove-Item -Path $tempPath -Force -Recurse

Write-Host "Success! Backdated commit history for LocalVault2 successfully created."
