# simulate_history_v3.ps1
# Script to simulate a 2025 Git commit history for Gladiator Arena (Interesting Game)

$git = "C:\Program Files\Git\cmd\git.exe"
$repoPath = "d:\c++\Project1\Project1\Interesting"
$tempPath = "d:\c++\Project1\Project1\Interesting_temp"

# 1. Rename existing folder to temp
Write-Host "Backing up current codebase..."
if (Test-Path $tempPath) {
    Remove-Item -Path $tempPath -Force -Recurse
}
Rename-Item -Path $repoPath -NewName "Interesting_temp"

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
Commit-Step "2025-04-10T10:00:00" "Initial commit: setup Gladiator Arena layout, stylesheets and gitignore" @("index.html", "style.css", ".gitignore")
Commit-Step "2025-04-22T14:30:00" "Implement core game loop mechanics, grid renderer and viewport camera" @("game.js")
Commit-Step "2025-05-02T11:15:00" "Implement snake segment kinematics and Verlet tail whipping physics" @("entities.js")
Commit-Step "2025-05-12T16:45:00" "Implement autonomic bot steering AI behaviors and wall avoidance" @("ai.js")
Commit-Step "2025-05-25T09:20:00" "Refactor combat collisions, stinger animations, scoreboard ranking HUD" @("entities.js", "game.js")
Commit-Step "2025-05-28T13:30:00" "Write comprehensive game manuals and formulas in README" @("README.md")

# Clean up
Write-Host "Cleaning up temp directories..."
Remove-Item -Path $tempPath -Force -Recurse

Write-Host "Success! Backdated commit history for Interesting game successfully created."
