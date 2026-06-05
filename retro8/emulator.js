const CHIP8_FONTSET = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80  // F
];

class Chip8Emulator {
    constructor() {
        this.memory = new Uint8Array(4096);
        this.v = new Uint8Array(16); // Registers V0 to VF
        this.i = 0; // Index register
        this.pc = 0x200; // Program counter starts at 0x200
        this.stack = new Uint16Array(16);
        this.sp = 0; // Stack pointer
        this.delayTimer = 0;
        this.soundTimer = 0;
        this.display = new Uint8Array(64 * 32);
        this.keys = new Array(16).fill(false);
        this.drawFlag = false;
        
        // Audio
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.soundEnabled = false;
        
        this.reset();
    }

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.connect(this.audioCtx.destination);
            this.gainNode.gain.value = 0;
            
            this.oscillator = this.audioCtx.createOscillator();
            this.oscillator.type = 'square';
            this.oscillator.frequency.value = 440;
            this.oscillator.connect(this.gainNode);
            this.oscillator.start();
            this.soundEnabled = true;
        }
    }

    playBeep(play) {
        if (!this.soundEnabled) return;
        if (play) {
            this.gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        } else {
            this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        }
    }

    reset() {
        this.memory.fill(0);
        this.v.fill(0);
        this.i = 0;
        this.pc = 0x200;
        this.stack.fill(0);
        this.sp = 0;
        this.delayTimer = 0;
        this.soundTimer = 0;
        this.display.fill(0);
        this.keys.fill(false);
        this.drawFlag = true;

        // Load fonts into memory (0x050 - 0x09F)
        for (let i = 0; i < CHIP8_FONTSET.length; i++) {
            this.memory[0x50 + i] = CHIP8_FONTSET[i];
        }
        
        if (this.soundEnabled) this.playBeep(false);
    }

    loadRom(romBuffer) {
        this.reset();
        for (let i = 0; i < romBuffer.length; i++) {
            this.memory[0x200 + i] = romBuffer[i];
        }
    }

    tickTimers() {
        if (this.delayTimer > 0) this.delayTimer--;
        
        if (this.soundTimer > 0) {
            if (this.soundTimer === 1) {
                this.playBeep(true);
            }
            this.soundTimer--;
        } else {
            this.playBeep(false);
        }
    }

    cycle() {
        // Fetch opcode (2 bytes)
        const opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
        
        // Decode and execute
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        const n = opcode & 0x000F;
        const nn = opcode & 0x00FF;
        const nnn = opcode & 0x0FFF;

        this.pc += 2;

        switch (opcode & 0xF000) {
            case 0x0000:
                switch (opcode) {
                    case 0x00E0: // CLS
                        this.display.fill(0);
                        this.drawFlag = true;
                        break;
                    case 0x00EE: // RET
                        this.sp--;
                        this.pc = this.stack[this.sp];
                        break;
                }
                break;
            case 0x1000: // JP addr
                this.pc = nnn;
                break;
            case 0x2000: // CALL addr
                this.stack[this.sp] = this.pc;
                this.sp++;
                this.pc = nnn;
                break;
            case 0x3000: // SE Vx, byte
                if (this.v[x] === nn) this.pc += 2;
                break;
            case 0x4000: // SNE Vx, byte
                if (this.v[x] !== nn) this.pc += 2;
                break;
            case 0x5000: // SE Vx, Vy
                if (this.v[x] === this.v[y]) this.pc += 2;
                break;
            case 0x6000: // LD Vx, byte
                this.v[x] = nn;
                break;
            case 0x7000: // ADD Vx, byte
                this.v[x] = (this.v[x] + nn) & 0xFF;
                break;
            case 0x8000:
                switch (n) {
                    case 0x0: this.v[x] = this.v[y]; break;
                    case 0x1: this.v[x] |= this.v[y]; break;
                    case 0x2: this.v[x] &= this.v[y]; break;
                    case 0x3: this.v[x] ^= this.v[y]; break;
                    case 0x4: 
                        let sum = this.v[x] + this.v[y];
                        this.v[0xF] = sum > 0xFF ? 1 : 0;
                        this.v[x] = sum & 0xFF;
                        break;
                    case 0x5:
                        this.v[0xF] = this.v[x] >= this.v[y] ? 1 : 0;
                        this.v[x] = (this.v[x] - this.v[y]) & 0xFF;
                        break;
                    case 0x6:
                        this.v[0xF] = this.v[x] & 0x1;
                        this.v[x] >>= 1;
                        break;
                    case 0x7:
                        this.v[0xF] = this.v[y] >= this.v[x] ? 1 : 0;
                        this.v[x] = (this.v[y] - this.v[x]) & 0xFF;
                        break;
                    case 0xE:
                        this.v[0xF] = (this.v[x] & 0x80) >> 7;
                        this.v[x] = (this.v[x] << 1) & 0xFF;
                        break;
                }
                break;
            case 0x9000: // SNE Vx, Vy
                if (this.v[x] !== this.v[y]) this.pc += 2;
                break;
            case 0xA000: // LD I, addr
                this.i = nnn;
                break;
            case 0xB000: // JP V0, addr
                this.pc = nnn + this.v[0];
                break;
            case 0xC000: // RND Vx, byte
                this.v[x] = Math.floor(Math.random() * 0x100) & nn;
                break;
            case 0xD000: // DRW Vx, Vy, nibble
                const vx = this.v[x] % 64;
                const vy = this.v[y] % 32;
                this.v[0xF] = 0;
                
                for (let row = 0; row < n; row++) {
                    const spriteByte = this.memory[this.i + row];
                    for (let col = 0; col < 8; col++) {
                        const spritePixel = spriteByte & (0x80 >> col);
                        const screenX = vx + col;
                        const screenY = vy + row;
                        
                        if (screenX < 64 && screenY < 32 && spritePixel) {
                            const index = screenX + (screenY * 64);
                            if (this.display[index] === 1) {
                                this.v[0xF] = 1;
                            }
                            this.display[index] ^= 1;
                        }
                    }
                }
                this.drawFlag = true;
                break;
            case 0xE000:
                switch (nn) {
                    case 0x9E:
                        if (this.keys[this.v[x] & 0xF]) this.pc += 2;
                        break;
                    case 0xA1:
                        if (!this.keys[this.v[x] & 0xF]) this.pc += 2;
                        break;
                }
                break;
            case 0xF000:
                switch (nn) {
                    case 0x07: this.v[x] = this.delayTimer; break;
                    case 0x0A:
                        let keyPressed = false;
                        for (let k = 0; k < 16; k++) {
                            if (this.keys[k]) {
                                this.v[x] = k;
                                keyPressed = true;
                                break;
                            }
                        }
                        if (!keyPressed) this.pc -= 2; // block execution
                        break;
                    case 0x15: this.delayTimer = this.v[x]; break;
                    case 0x18: this.soundTimer = this.v[x]; break;
                    case 0x1E: this.i += this.v[x]; break;
                    case 0x29: this.i = 0x50 + ((this.v[x] & 0x0F) * 5); break;
                    case 0x33:
                        this.memory[this.i] = Math.floor(this.v[x] / 100);
                        this.memory[this.i + 1] = Math.floor((this.v[x] % 100) / 10);
                        this.memory[this.i + 2] = this.v[x] % 10;
                        break;
                    case 0x55:
                        for (let k = 0; k <= x; k++) {
                            this.memory[this.i + k] = this.v[k];
                        }
                        break;
                    case 0x65:
                        for (let k = 0; k <= x; k++) {
                            this.v[k] = this.memory[this.i + k];
                        }
                        break;
                }
                break;
        }
    }
}
