// Core Chip-8 CPU Emulator class
class Chip8 {
  constructor() {
    this.memory = new Uint8Array(4096);
    this.v = new Uint8Array(16); // V0-VF registers
    this.i = 0; // Index register
    this.pc = 0x200; // Program counter starts at 0x200
    
    // Stack and stack pointer
    this.stack = new Uint16Array(16);
    this.sp = 0;
    
    // Timers
    this.delayTimer = 0;
    this.soundTimer = 0;
    
    // Display buffer (64x32 monochrome grid)
    this.display = new Uint8Array(64 * 32);
    
    // Keyboard input state (16 keys: 0x0 to 0xF)
    this.keys = new Uint8Array(16);
    
    // Sound Context for Web Audio API
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.isMuted = false;

    // Font Set (80 bytes) loaded into memory [0x50 - 0x9F]
    this.fontSet = [
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

    this.reset();
  }

  reset() {
    // Clear RAM
    this.memory.fill(0);
    
    // Load Fonts into standard location 0x50
    for (let idx = 0; idx < this.fontSet.length; idx++) {
      this.memory[0x50 + idx] = this.fontSet[idx];
    }

    // Reset CPU Registers
    this.v.fill(0);
    this.i = 0;
    this.pc = 0x200;
    this.sp = 0;
    this.stack.fill(0);

    // Clear Screen & Input
    this.display.fill(0);
    this.keys.fill(0);

    // Reset Timers
    this.delayTimer = 0;
    this.soundTimer = 0;

    // Stop active audio
    this.stopBeep();
  }

  loadROM(romData) {
    this.reset();
    
    // Copy ROM bytes starting from 0x200
    for (let idx = 0; idx < romData.length; idx++) {
      if (0x200 + idx < 4096) {
        this.memory[0x200 + idx] = romData[idx];
      }
    }
  }

  tickTimers() {
    if (this.delayTimer > 0) {
      this.delayTimer--;
    }
    if (this.soundTimer > 0) {
      this.soundTimer--;
      if (this.soundTimer === 0) {
        this.stopBeep();
      } else {
        this.startBeep();
      }
    } else {
      this.stopBeep();
    }
  }

  // Audio synthesis helper using Web Audio API
  startBeep() {
    if (this.isMuted) return;
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    if (!this.oscillator) {
      this.oscillator = this.audioCtx.createOscillator();
      this.gainNode = this.audioCtx.createGain();
      
      this.oscillator.type = 'square'; // retro sound
      this.oscillator.frequency.setValueAtTime(440, this.audioCtx.currentTime); // 440Hz A4
      
      this.gainNode.gain.setValueAtTime(0.08, this.audioCtx.currentTime); // Low volume
      
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
      this.oscillator.start();
    }
  }

  stopBeep() {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
      this.gainNode = null;
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (mute) this.stopBeep();
  }

  // Decodes and runs a single opcode, returns descriptive structure for debugging
  step() {
    if (this.pc >= 4095) {
      return { opcode: 0, desc: "End of Memory Limit" };
    }

    const opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
    
    // Parse parts of opcode
    const nnn = opcode & 0x0FFF;
    const n = opcode & 0x000F;
    const x = (opcode & 0x0F00) >> 8;
    const y = (opcode & 0x00F0) >> 4;
    const kk = opcode & 0x00FF;

    // Advance Program Counter
    this.pc += 2;

    let desc = "Unknown Opcode";

    switch (opcode & 0xF000) {
      case 0x0000:
        switch (opcode) {
          case 0x00E0: // CLS - Clear screen
            this.display.fill(0);
            desc = "CLS (Clear screen)";
            break;
          case 0x00EE: // RET - Return from subroutine
            if (this.sp > 0) {
              this.sp--;
              this.pc = this.stack[this.sp];
              desc = `RET (Return to address 0x${this.pc.toString(16).toUpperCase()})`;
            } else {
              desc = "RET Error (Stack underflow)";
            }
            break;
          default:
            desc = `SYS 0x${nnn.toString(16).toUpperCase()} (Ignored)`;
            break;
        }
        break;

      case 0x1000: // JP addr - Jump to NNN
        this.pc = nnn;
        desc = `JP 0x${nnn.toString(16).toUpperCase()}`;
        break;

      case 0x2000: // CALL addr - Call subroutine at NNN
        if (this.sp < 16) {
          this.stack[this.sp] = this.pc;
          this.sp++;
          this.pc = nnn;
          desc = `CALL 0x${nnn.toString(16).toUpperCase()}`;
        } else {
          desc = "CALL Error (Stack overflow)";
        }
        break;

      case 0x3000: // SE Vx, byte - Skip next if Vx == kk
        if (this.v[x] === kk) {
          this.pc += 2;
          desc = `SE V${x.toString(16).toUpperCase()} (Skip because V${x.toString(16).toUpperCase()}==0x${kk.toString(16).toUpperCase()})`;
        } else {
          desc = `SE V${x.toString(16).toUpperCase()} (No skip: 0x${this.v[x].toString(16).toUpperCase()}!=0x${kk.toString(16).toUpperCase()})`;
        }
        break;

      case 0x4000: // SNE Vx, byte - Skip next if Vx != kk
        if (this.v[x] !== kk) {
          this.pc += 2;
          desc = `SNE V${x.toString(16).toUpperCase()} (Skip: 0x${this.v[x].toString(16).toUpperCase()}!=0x${kk.toString(16).toUpperCase()})`;
        } else {
          desc = `SNE V${x.toString(16).toUpperCase()} (No skip: identical values)`;
        }
        break;

      case 0x5000: // SE Vx, Vy - Skip next if Vx == Vy
        if (this.v[x] === this.v[y]) {
          this.pc += 2;
          desc = `SE V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (Skip: equal)`;
        } else {
          desc = `SE V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (No skip: unequal)`;
        }
        break;

      case 0x6000: // LD Vx, byte - Set Vx = kk
        this.v[x] = kk;
        desc = `LD V${x.toString(16).toUpperCase()}, 0x${kk.toString(16).toUpperCase()}`;
        break;

      case 0x7000: // ADD Vx, byte - Set Vx = Vx + kk
        this.v[x] += kk; // Uint8Array handles wrap-around automatically (modulo 256)
        desc = `ADD V${x.toString(16).toUpperCase()}, 0x${kk.toString(16).toUpperCase()}`;
        break;

      case 0x8000:
        switch (n) {
          case 0x0: // LD Vx, Vy - Set Vx = Vy
            this.v[x] = this.v[y];
            desc = `LD V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()}`;
            break;
          case 0x1: // OR Vx, Vy
            this.v[x] |= this.v[y];
            desc = `OR V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()}`;
            break;
          case 0x2: // AND Vx, Vy
            this.v[x] &= this.v[y];
            desc = `AND V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()}`;
            break;
          case 0x3: // XOR Vx, Vy
            this.v[x] ^= this.v[y];
            desc = `XOR V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()}`;
            break;
          case 0x4: // ADD Vx, Vy - Vx += Vy, VF = carry
            {
              const sum = this.v[x] + this.v[y];
              this.v[0xF] = sum > 255 ? 1 : 0;
              this.v[x] = sum;
              desc = `ADD V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (VF=${this.v[0xF]})`;
            }
            break;
          case 0x5: // SUB Vx, Vy - Vx -= Vy, VF = NOT borrow
            {
              const valX = this.v[x];
              const valY = this.v[y];
              this.v[0xF] = valX >= valY ? 1 : 0;
              this.v[x] = valX - valY;
              desc = `SUB V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (VF=${this.v[0xF]})`;
            }
            break;
          case 0x6: // SHR Vx {, Vy} - Shift Vx right by 1, VF = LSB
            {
              const lsb = this.v[x] & 1;
              this.v[x] >>= 1;
              this.v[0xF] = lsb;
              desc = `SHR V${x.toString(16).toUpperCase()} (VF=${lsb})`;
            }
            break;
          case 0x7: // SUBN Vx, Vy - Set Vx = Vy - Vx, VF = NOT borrow
            {
              const valX = this.v[x];
              const valY = this.v[y];
              this.v[0xF] = valY >= valX ? 1 : 0;
              this.v[x] = valY - valX;
              desc = `SUBN V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (VF=${this.v[0xF]})`;
            }
            break;
          case 0xE: // SHL Vx {, Vy} - Shift Vx left by 1, VF = MSB
            {
              const msb = (this.v[x] & 0x80) >> 7;
              this.v[x] <<= 1;
              this.v[0xF] = msb;
              desc = `SHL V${x.toString(16).toUpperCase()} (VF=${msb})`;
            }
            break;
          default:
            desc = `Unknown 8-op: 0x${opcode.toString(16).toUpperCase()}`;
            break;
        }
        break;

      case 0x9000: // SNE Vx, Vy - Skip next if Vx != Vy
        if (this.v[x] !== this.v[y]) {
          this.pc += 2;
          desc = `SNE V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (Skip: unequal)`;
        } else {
          desc = `SNE V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()} (No skip)`;
        }
        break;

      case 0xA000: // LD I, addr - Set I = NNN
        this.i = nnn;
        desc = `LD I, 0x${nnn.toString(16).toUpperCase()}`;
        break;

      case 0xB000: // JP V0, addr - Jump to NNN + V0
        this.pc = nnn + this.v[0];
        desc = `JP V0 + 0x${nnn.toString(16).toUpperCase()} (Target: 0x${this.pc.toString(16).toUpperCase()})`;
        break;

      case 0xC000: // RND Vx, byte - Set Vx = Random AND kk
        {
          const randomVal = Math.floor(Math.random() * 256);
          this.v[x] = randomVal & kk;
          desc = `RND V${x.toString(16).toUpperCase()}, 0x${kk.toString(16).toUpperCase()} (Rnd=0x${randomVal.toString(16).toUpperCase()})`;
        }
        break;

      case 0xD000: // DRW Vx, Vy, nibble - Draw sprite from memory at I into (Vx, Vy), size 8xN
        {
          const xCoord = this.v[x] % 64;
          const yCoord = this.v[y] % 32;
          this.v[0xF] = 0; // Collision flag reset

          for (let row = 0; row < n; row++) {
            const spriteByte = this.memory[this.i + row];
            for (let col = 0; col < 8; col++) {
              // Bit check in sprite row byte (from MSB to LSB)
              if ((spriteByte & (0x80 >> col)) !== 0) {
                const targetX = (xCoord + col);
                const targetY = (yCoord + row);
                
                // Wrap coordinates? Standard Chip-8 clips or wraps. Let's clip to prevent screen overflow errors, or wrap. 
                // Classic games usually wrap or clip. Let's clip/prevent out of bounds to keep it simple.
                if (targetX < 64 && targetY < 32) {
                  const pixelIndex = targetX + targetY * 64;
                  if (this.display[pixelIndex] === 1) {
                    this.v[0xF] = 1; // Collision detected
                  }
                  this.display[pixelIndex] ^= 1; // XOR pixel
                }
              }
            }
          }
          desc = `DRW V${x.toString(16).toUpperCase()}, V${y.toString(16).toUpperCase()}, ${n} (Drawing sprite from I)`;
        }
        break;

      case 0xE000:
        switch (kk) {
          case 0x9E: // SKP Vx - Skip next if key corresponding to Vx is pressed
            if (this.keys[this.v[x]] === 1) {
              this.pc += 2;
              desc = `SKP V${x.toString(16).toUpperCase()} (Skip: Key 0x${this.v[x].toString(16).toUpperCase()} pressed)`;
            } else {
              desc = `SKP V${x.toString(16).toUpperCase()} (No skip: Key 0x${this.v[x].toString(16).toUpperCase()} up)`;
            }
            break;
          case 0xA1: // SKNP Vx - Skip next if key corresponding to Vx is not pressed
            if (this.keys[this.v[x]] !== 1) {
              this.pc += 2;
              desc = `SKNP V${x.toString(16).toUpperCase()} (Skip: Key 0x${this.v[x].toString(16).toUpperCase()} up)`;
            } else {
              desc = `SKNP V${x.toString(16).toUpperCase()} (No skip)`;
            }
            break;
          default:
            desc = `Unknown E-op: 0x${opcode.toString(16).toUpperCase()}`;
            break;
        }
        break;

      case 0xF000:
        switch (kk) {
          case 0x07: // LD Vx, DT - Set Vx = Delay Timer
            this.v[x] = this.delayTimer;
            desc = `LD V${x.toString(16).toUpperCase()}, DT (DT=0x${this.delayTimer.toString(16).toUpperCase()})`;
            break;
          case 0x0A: // LD Vx, K - Wait for key press (blocking opcode)
            {
              let keyPressed = -1;
              for (let keyIdx = 0; keyIdx < 16; keyIdx++) {
                if (this.keys[keyIdx] === 1) {
                  keyPressed = keyIdx;
                  break;
                }
              }
              if (keyPressed !== -1) {
                this.v[x] = keyPressed;
                desc = `LD V${x.toString(16).toUpperCase()}, K (Key 0x${keyPressed.toString(16).toUpperCase()} pressed, resume)`;
              } else {
                // If no key is pressed, rewind PC by 2 so we keep executing this opcode
                this.pc -= 2;
                desc = `LD V${x.toString(16).toUpperCase()}, K (Waiting for keypress - BLOCKED)`;
              }
            }
            break;
          case 0x15: // LD DT, Vx - Set Delay Timer = Vx
            this.delayTimer = this.v[x];
            desc = `LD DT, V${x.toString(16).toUpperCase()} (Set DT to 0x${this.v[x].toString(16).toUpperCase()})`;
            break;
          case 0x18: // LD ST, Vx - Set Sound Timer = Vx
            this.soundTimer = this.v[x];
            desc = `LD ST, V${x.toString(16).toUpperCase()} (Set ST to 0x${this.v[x].toString(16).toUpperCase()})`;
            break;
          case 0x1E: // ADD I, Vx - Set I = I + Vx
            this.i = (this.i + this.v[x]) & 0xFFFF; // Wrap at 16-bit
            desc = `ADD I, V${x.toString(16).toUpperCase()}`;
            break;
          case 0x29: // LD F, Vx - Set I = character sprite address for Vx font char
            // Since font set starts at 0x50, and each font character sprite is 5 bytes tall:
            this.i = 0x50 + (this.v[x] & 0x0F) * 5;
            desc = `LD F, V${x.toString(16).toUpperCase()} (Character sprite for 0x${(this.v[x]&0xf).toString(16).toUpperCase()})`;
            break;
          case 0x33: // LD B, Vx - Store BCD representation of Vx at I, I+1, I+2
            {
              const val = this.v[x];
              this.memory[this.i] = Math.floor(val / 100);
              this.memory[this.i + 1] = Math.floor((val % 100) / 10);
              this.memory[this.i + 2] = val % 10;
              desc = `LD B, V${x.toString(16).toUpperCase()} (Stored BCD: ${this.memory[this.i]}, ${this.memory[this.i + 1]}, ${this.memory[this.i + 2]})`;
            }
            break;
          case 0x55: // LD [I], Vx - Store V0-Vx in memory starting at I
            for (let idx = 0; idx <= x; idx++) {
              this.memory[this.i + idx] = this.v[idx];
            }
            desc = `LD [I], V${x.toString(16).toUpperCase()} (Store V0-V${x.toString(16).toUpperCase()} at I)`;
            break;
          case 0x65: // LD Vx, [I] - Read V0-Vx from memory starting at I
            for (let idx = 0; idx <= x; idx++) {
              this.v[idx] = this.memory[this.i + idx];
            }
            desc = `LD V${x.toString(16).toUpperCase()}, [I] (Load V0-V${x.toString(16).toUpperCase()} from I)`;
            break;
          default:
            desc = `Unknown F-op: 0x${opcode.toString(16).toUpperCase()}`;
            break;
        }
        break;

      default:
        desc = `Unknown Instruction: 0x${opcode.toString(16).toUpperCase()}`;
        break;
    }

    return { opcode, desc };
  }
}
