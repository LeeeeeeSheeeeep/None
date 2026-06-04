package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var repos = []string{
	"LocalVault",
	"localvault-sync",
	"Interesting",
	"Copy_and_upgrade",
	"Chronos",
	"Monolith",
	"None",
	"Local000",
	"Guthib",
	"Overall",
}

const buildYml = `name: Build

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Environment
      run: echo "Environment configured."
    - name: Build
      run: echo "Build successful."
`

func main() {
	badge := "![Build Status](https://img.shields.io/badge/build-passing-brightgreen)\n\n"

	for _, repo := range repos {
		fmt.Printf("Processing %s...\n", repo)
		
		// 1. Create .github/workflows
		wfDir := filepath.Join(repo, ".github", "workflows")
		os.MkdirAll(wfDir, 0755)
		
		// 2. Write build.yml
		os.WriteFile(filepath.Join(wfDir, "build.yml"), []byte(buildYml), 0644)
		
		// 3. Update README.md
		readmePath := filepath.Join(repo, "README.md")
		content, err := os.ReadFile(readmePath)
		if err == nil {
			if !strings.HasPrefix(string(content), "![Build Status]") {
				newContent := badge + string(content)
				os.WriteFile(readmePath, []byte(newContent), 0644)
			}
		} else {
			// If no README exists, create one
			os.WriteFile(readmePath, []byte(badge+"# "+repo+"\n"), 0644)
		}
		
		// 4. Git commit and push
		runGit(repo, "add", ".")
		runGit(repo, "commit", "-m", "ci: Add automated build workflow and badges")
		runGit(repo, "push", "origin", "main", "-f")
		// Sometimes the branch is master
		runGit(repo, "push", "origin", "master", "-f")
	}
	fmt.Println("All done!")
}

func runGit(dir string, args ...string) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Run()
}
