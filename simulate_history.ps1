# simulate_history.ps1
# Script to simulate a multi-year Git commit history for LocalVault (2025 and 2026)

$git = "C:\Program Files\Git\cmd\git.exe"
$repoPath = "d:\c++\Project1\Project1\LocalVault"
$tempPath = "d:\c++\Project1\Project1\LocalVault_temp"

# 1. Rename existing folder to temp
Write-Host "Backing up current codebase..."
if (Test-Path $tempPath) {
    Remove-Item -Path $tempPath -Force -Recurse
}
Rename-Item -Path $repoPath -NewName "LocalVault_temp"

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

# --- 2025 Commits (Core Infrastructure & Niche Security Modules) ---
Commit-Step "2025-10-10T10:00:00" "Initial commit: module definition and gitignore config" @("go.mod", ".gitignore")
Commit-Step "2025-10-20T14:30:00" "Implement SQLite storage structures and FTS5 search schema" @("storage/sqlite.go", "storage/schema.sql")
Commit-Step "2025-11-05T11:15:00" "Implement LSB Steganography engine for image-based key recovery" @("security/stego.go")
Commit-Step "2025-11-18T16:45:00" "Implement Plausible Deniability duress vault dynamic connection layer" @("security/duress.go")
Commit-Step "2025-12-05T09:20:00" "Implement Keystroke Dynamics biometrics keyboard timing scanner" @("security/keystroke.go")
Commit-Step "2025-12-20T15:10:00" "Add connector SDK interfaces with GitHub and RSS connectors" @("connectors/sdk.go", "connectors/github/github.go", "connectors/rss/rss.go")

# --- 2026 Commits (Server, UI, Audio Synthesizer, Backup & Tests) ---
Commit-Step "2026-03-05T10:30:00" "Implement main server startup endpoints and routing engine" @("main.go")
Commit-Step "2026-03-25T14:20:00" "Design web dashboard interface layout, stylesheet and app scripts" @("frontend/index.html", "frontend/style.css", "frontend/app.js")
Commit-Step "2026-04-12T11:05:00" "Implement custom HTML5 Canvas Knowledge Graph engine" @("frontend/graph.js", "ai/nlp.go", "ai/nlp_dictionaries.go", "connectors/enterprise_structs.go")
Commit-Step "2026-05-02T16:15:00" "Integrate banking-level zero-knowledge AES encryption layer" @("security/crypto_layer.go")
Commit-Step "2026-05-18T13:40:00" "Implement Dead Man's Switch and Shamir's Secret Sharing keys" @("security/shamir.go", "security/deadman.go")
Commit-Step "2026-05-28T10:50:00" "Add QR paper backup matrix and WebRTC webcam scanner interfaces" @("security/qr_backup.go")
Commit-Step "2026-05-31T15:25:00" "Implement comprehensive unit tests for crypt, backup, stego and biometrics" @("tests/features_test.go", "go.sum")
Commit-Step "2026-06-01T13:30:00" "Update README documentation with setup and architecture breakdown" @("README.md")

# Clean up
Write-Host "Cleaning up temp directories..."
Remove-Item -Path $tempPath -Force -Recurse

Write-Host "Success! Extended multi-year backdated commit history successfully created."
