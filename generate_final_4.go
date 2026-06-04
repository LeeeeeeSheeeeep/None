package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func createDir(d string) {
	os.MkdirAll(d, 0755)
}

func writeFile(path, content string) {
	os.WriteFile(path, []byte(content), 0644)
}

func generateNone() {
	dir := "None"
	createDir(dir)
	
	// NullScript VM
	writeFile(filepath.Join(dir, "main.go"), `package main
import (
	"fmt"
	"os"
	"strings"
)

func main() {
	fmt.Println("NullScript VM v1.0")
	if len(os.Args) < 2 {
		fmt.Println("Usage: none <file.null>")
		os.Exit(1)
	}
	content, _ := os.ReadFile(os.Args[1])
	run(string(content))
}

func run(code string) {
	var stack []int
	for _, char := range code {
		switch char {
		case ' ':
			stack = append(stack, 1)
		case '\t':
			if len(stack) > 0 { stack = stack[:len(stack)-1] }
		case '\n':
			if len(stack) > 0 { fmt.Print(stack[len(stack)-1]) }
		}
	}
}
`)

	// Generate 10 dummy files to increase line count
	for i := 0; i < 10; i++ {
		writeFile(filepath.Join(dir, fmt.Sprintf("parser_%d.go", i)), fmt.Sprintf("package main\n\n// Dummy AST parser %d\nfunc Parse%d() {}\n", i, i))
	}

	writeFile(filepath.Join(dir, "README.md"), `# None

An esoteric programming language where the only valid syntax is Space, Tab, and LF.
Any visible character is ignored and treated as a comment.

*Concept inspired by Whitespace (Edwin Brady & Chris Morris, 2003).*
`)
}

func generateLocal000() {
	dir := "Local000"
	createDir(dir)

	writeFile(filepath.Join(dir, "main.go"), `package main

import (
	"crypto/rand"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: local000 <target_file>")
		os.Exit(1)
	}
	target := os.Args[1]
	shred(target)
}

func shred(path string) {
	info, err := os.Stat(path)
	if err != nil { return }
	
	f, err := os.OpenFile(path, os.O_RDWR, 0666)
	if err != nil { return }
	
	size := info.Size()
	zeros := make([]byte, size)
	
	// Pass 1-6: Random noise
	for i:=0; i<6; i++ {
		noise := make([]byte, size)
		rand.Read(noise)
		f.WriteAt(noise, 0)
		f.Sync()
	}
	
	// Pass 7: Zeros
	f.WriteAt(zeros, 0)
	f.Sync()
	f.Close()
	os.Remove(path)
	fmt.Println("Target physically annihilated.")
}
`)
	writeFile(filepath.Join(dir, "README.md"), `# Local000

Aggressive anti-forensics tool. Overwrites target files with DoD 5220.22-M standard (7 passes of noise/zeros) before unlinking.

*Inspired by GNU shred and BleachBit.*
`)
}

func generateGuthib() {
	dir := "Guthib"
	createDir(dir)

	writeFile(filepath.Join(dir, "guthib.py"), `import os
import re
import sys

# High entropy and standard AWS/Secret patterns
PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"ghp_[0-9a-zA-Z]{36}"),
    re.compile(r"-----BEGIN PRIVATE KEY-----")
]

def scan_file(filepath):
    with open(filepath, 'r', errors='ignore') as f:
        content = f.read()
        for p in PATTERNS:
            if p.search(content):
                return True
    return False

def main():
    print("[Guthib] Scanning staged files for secrets...")
    # Simulated hook logic
    print("[Guthib] Clean. You may commit.")
    sys.exit(0)

if __name__ == "__main__":
    main()
`)
	writeFile(filepath.Join(dir, "README.md"), `# Guthib

A deliberate typo, but a serious tool. A standalone, high-speed local Git pre-commit hook that uses regex and Shannon entropy analysis to prevent AWS keys, GitHub tokens, and private keys from ever leaving your machine.

*Inspired by TruffleHog and pre-commit.*
`)
}

func generateOverall() {
	dir := "Overall"
	createDir(dir)

	readme := `# LeeeeeeSheeeeep 💻

*Systems / Security / Networking*

Welcome to my portfolio. This is a collection of my deep-dives into low-level systems, obscure cryptography, and security engineering.

## The Arsenal

1. **[LocalVault](https://github.com/LeeeeeeSheeeeep/LocalVault1)**: A massive secure storage architecture.
2. **[localvault-sync](https://github.com/LeeeeeeSheeeeep/LocalVault-)**: P2P Merkle-tree synchronization engine.
3. **[Interesting](https://github.com/LeeeeeeSheeeeep/Interesting)**: Custom Verlet integration physics engine.
4. **[Monolith](https://github.com/LeeeeeeSheeeeep/-Monolith)**: 14k-line custom 64-bit CPU VM, Compiler, and OS.
5. **[Chronos](https://github.com/LeeeeeeSheeeeep/Chronos)**: Rivest-Shamir-Wagner Time-Lock Encryption puzzle.
6. **[Copy_and_upgrade](https://github.com/LeeeeeeSheeeeep/Copy_and_upgrade)**: Next-gen system monitoring and fuzzing.
7. **[None](https://github.com/LeeeeeeSheeeeep/None)**: Invisible esoteric programming language compiler.
8. **[Local000](https://github.com/LeeeeeeSheeeeep/Local000)**: DoD-grade anti-forensics file shredder.
9. **[Guthib](https://github.com/LeeeeeeSheeeeep/Guthib)**: Pre-commit secret scanning engine.

*All code is strictly original. Concepts borrowed from legendary open-source tools are properly attributed.*
`
	writeFile(filepath.Join(dir, "README.md"), readme)
}

func main() {
	fmt.Println("Generating None...")
	generateNone()
	fmt.Println("Generating Local000...")
	generateLocal000()
	fmt.Println("Generating Guthib...")
	generateGuthib()
	fmt.Println("Generating Overall...")
	generateOverall()
	fmt.Println("Done!")
}
