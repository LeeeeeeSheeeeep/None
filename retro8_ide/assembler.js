// Retro-8 Chip-8 Mnemonic Assembler Compiler
class Assembler {
  constructor() {
    this.templates = {
      drawBox: `; --- Demo 1: Bouncing Square ---
; Registers:
; V0 = X coordinate
; V1 = Y coordinate
; V2 = X velocity (1 or -1)
; V3 = Y velocity (1 or -1)

LD V0, 5       ; X position
LD V1, 5       ; Y position
LD V2, 1       ; X speed
LD V3, 1       ; Y speed

Loop:
  CLS          ; Clear screen
  LD I, Square ; Point to Sprite
  DRW V0, V1, 4; Draw 8x4 square

  ; Delay loop (simulate timer wait)
  LD V4, 30
Delay:
  ADD V4, -1
  SNE V4, 0
  JP Delay

  ; Update physics
  ADD V0, V2
  ADD V1, V3

  ; Boundary checks
  ; Check X >= 56 (64 - 8 width)
  LD V5, V0
  ADD V5, -56
  SE V5, 0     ; If X == 56
  JP BounceX
  SE V0, 0     ; If X == 0
  JP BounceX
  
CheckY:
  ; Check Y >= 28 (32 - 4 height)
  LD V5, V1
  ADD V5, -28
  SE V5, 0     ; If Y == 28
  JP BounceY
  SE V1, 0     ; If Y == 0
  JP BounceY

  JP Loop

BounceX:
  LD V6, 0
  SUB V6, V2   ; Reverse V2
  LD V2, V6
  JP CheckY

BounceY:
  LD V6, 0
  SUB V6, V3   ; Reverse V3
  LD V3, V6
  JP Loop

Square:
  DB 0xFF      ; 11111111
  DB 0x81      ; 10000001
  DB 0x81      ; 10000001
  DB 0xFF      ; 11111111
`,
      keyboard: `; --- Demo 2: Keyboard Sprite Controller ---
; Use keys 'A' (4) or 'D' (6) to move sprite left/right
; Use keys 'W' (2) or 'S' (8) to move sprite up/down

LD V0, 28      ; V0 = Player X
LD V1, 14      ; V1 = Player Y

Loop:
  CLS
  LD I, Sprite
  DRW V0, V1, 5  ; Draw player

Update:
  ; Check Key 2 (W) -> Up
  LD V2, 2
  SKNP V2
  ADD V1, -1

  ; Check Key 8 (S) -> Down
  LD V2, 8
  SKNP V2
  ADD V1, 1

  ; Check Key 4 (A) -> Left
  LD V2, 4
  SKNP V2
  ADD V0, -1

  ; Check Key 6 (D) -> Right
  LD V2, 6
  SKNP V2
  ADD V0, 1

  ; Frame Delay
  LD V4, 25
Delay:
  ADD V4, -1
  SNE V4, 0
  JP Delay

  JP Loop

Sprite:
  DB 0x3C  ;   ****  
  DB 0x7E  ;  ****** 
  DB 0xFF  ; ********
  DB 0x7E  ;  ****** 
  DB 0x3C  ;   ****  
`
    };
  }

  // Compile assembly code string into Uint8Array
  assemble(codeText) {
    const lines = codeText.split('\n');
    const parsedLines = [];
    const labels = {};
    let currentAddress = 0x200; // ROM starts at 0x200
    const errors = [];

    // --- PASS 1: Clean comments, normalize lines, and extract Labels ---
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      let line = lines[i];

      // Remove comments (starting with ; or //)
      line = line.split(';')[0].split('//')[0].trim();
      if (line === '') continue; // Skip empty lines

      // Check if line defines a label (ends with :)
      if (line.includes(':')) {
        const parts = line.split(':');
        const labelName = parts[0].trim();
        
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName)) {
          errors.push(`Line ${lineNum}: Invalid label name "${labelName}"`);
          continue;
        }
        if (labels[labelName] !== undefined) {
          errors.push(`Line ${lineNum}: Redefined label "${labelName}"`);
          continue;
        }
        
        labels[labelName] = currentAddress;
        
        // If there's code after the colon, process it
        line = parts.slice(1).join(':').trim();
        if (line === '') continue;
      }

      // Analyze instructions to advance address pointer
      const tokens = this.tokenize(line);
      const mnemonic = tokens[0].toUpperCase();

      parsedLines.push({
        lineNum,
        address: currentAddress,
        original: line,
        mnemonic,
        args: tokens.slice(1)
      });

      // DB allocates 1 byte per argument. Other instructions compile to 2-byte opcodes.
      if (mnemonic === 'DB' || mnemonic === 'BYTE') {
        currentAddress += tokens.slice(1).length;
      } else {
        currentAddress += 2;
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const bytecode = [];
    
    // --- PASS 2: Compile instructions into binary ---
    for (const parsed of parsedLines) {
      const { lineNum, address, mnemonic, args, original } = parsed;
      try {
        const op = this.compileOpcode(mnemonic, args, labels);
        if (op === null) {
          errors.push(`Line ${lineNum}: Syntax error in instruction: "${original}"`);
        } else {
          // op is either a list of bytes (DB) or a single 16-bit word (standard opcode)
          if (Array.isArray(op)) {
            bytecode.push(...op);
          } else {
            bytecode.push((op & 0xFF00) >> 8);
            bytecode.push(op & 0x00FF);
          }
        }
      } catch (err) {
        errors.push(`Line ${lineNum}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: new Uint8Array(bytecode) };
  }

  // Splits line into tokens (respecting commas and spacing)
  tokenize(line) {
    // Replace commas with spaces and split by whitespace
    const cleaned = line.replace(/,/g, ' ');
    return cleaned.split(/\s+/).filter(t => t !== '');
  }

  // Parse numeric values (supporting decimals, hex 0xNN, or trailing h/H like 0Ah)
  parseNumber(str, labels) {
    if (labels && labels[str] !== undefined) {
      return labels[str];
    }

    const s = str.trim().toLowerCase();
    if (s.startsWith('0x')) {
      return parseInt(s.substring(2), 16);
    }
    if (s.endsWith('h')) {
      return parseInt(s.substring(0, s.length - 1), 16);
    }
    if (/^\d+$/.test(s)) {
      return parseInt(s, 10);
    }
    // Allow negative numbers
    if (s.startsWith('-')) {
      const num = parseInt(s.substring(1), 10);
      return (-num) & 0xFF; // Wrap to 8-bit representation
    }

    throw new Error(`Invalid numeric literal or unknown label: "${str}"`);
  }

  // Parses V0-VF register string and returns integer index 0-15
  parseRegister(str) {
    const match = str.trim().match(/^V([0-F])$/i);
    if (!match) {
      throw new Error(`Invalid register format (use V0-VF): "${str}"`);
    }
    return parseInt(match[1], 16);
  }

  // Compiles standard mnemonics into CHIP-8 hexadecimal words
  compileOpcode(mnemonic, args, labels) {
    const len = args.length;

    switch (mnemonic) {
      case 'DB':
      case 'BYTE':
        if (len === 0) throw new Error("DB instruction requires at least one byte argument");
        return args.map(arg => this.parseNumber(arg, labels) & 0xFF);

      case 'CLS':
        if (len !== 0) throw new Error("CLS takes no arguments");
        return 0x00E0;

      case 'RET':
        if (len !== 0) throw new Error("RET takes no arguments");
        return 0x00EE;

      case 'JP':
        if (len === 1) {
          // JP addr -> 1NNN
          const addr = this.parseNumber(args[0], labels);
          return 0x1000 | (addr & 0x0FFF);
        } else if (len === 2 && args[0].toUpperCase() === 'V0') {
          // JP V0, addr -> BNNN
          const addr = this.parseNumber(args[1], labels);
          return 0xB000 | (addr & 0x0FFF);
        }
        throw new Error("Invalid JP arguments (use 'JP addr' or 'JP V0, addr')");

      case 'CALL':
        if (len !== 1) throw new Error("CALL takes exactly 1 address argument");
        {
          const addr = this.parseNumber(args[0], labels);
          return 0x2000 | (addr & 0x0FFF);
        }

      case 'SE':
        if (len !== 2) throw new Error("SE takes exactly 2 arguments");
        {
          const rx = this.parseRegister(args[0]);
          if (args[1].toUpperCase().startsWith('V')) {
            // SE Vx, Vy -> 5XY0
            const ry = this.parseRegister(args[1]);
            return 0x5000 | (rx << 8) | (ry << 4);
          } else {
            // SE Vx, kk -> 3XKK
            const kk = this.parseNumber(args[1], labels) & 0xFF;
            return 0x3000 | (rx << 8) | kk;
          }
        }

      case 'SNE':
        if (len !== 2) throw new Error("SNE takes exactly 2 arguments");
        {
          const rx = this.parseRegister(args[0]);
          if (args[1].toUpperCase().startsWith('V')) {
            // SNE Vx, Vy -> 9XY0
            const ry = this.parseRegister(args[1]);
            return 0x9000 | (rx << 8) | (ry << 4);
          } else {
            // SNE Vx, kk -> 4XKK
            const kk = this.parseNumber(args[1], labels) & 0xFF;
            return 0x4000 | (rx << 8) | kk;
          }
        }

      case 'LD':
        if (len !== 2) throw new Error("LD takes exactly 2 arguments");
        {
          const arg0 = args[0].toUpperCase();
          const arg1 = args[1].toUpperCase();

          if (arg0.startsWith('V') && !arg0.endsWith(']')) {
            const rx = this.parseRegister(arg0);
            if (arg1.startsWith('V')) {
              // LD Vx, Vy -> 8XY0
              const ry = this.parseRegister(arg1);
              return 0x8000 | (rx << 8) | (ry << 4);
            } else if (arg1 === 'DT') {
              // LD Vx, DT -> FX07
              return 0xF007 | (rx << 8);
            } else if (arg1 === 'K') {
              // LD Vx, K -> FX0A
              return 0xF00A | (rx << 8);
            } else if (arg1.startsWith('[I]')) {
              // LD Vx, [I] -> FX65
              return 0xF065 | (rx << 8);
            } else {
              // LD Vx, kk -> 6XKK
              const kk = this.parseNumber(arg1, labels) & 0xFF;
              return 0x6000 | (rx << 8) | kk;
            }
          } else if (arg0 === 'I') {
            // LD I, NNN -> ANNN
            const nnn = this.parseNumber(arg1, labels);
            return 0xA000 | (nnn & 0x0FFF);
          } else if (arg0 === 'DT') {
            // LD DT, Vx -> FX15
            const rx = this.parseRegister(arg1);
            return 0xF015 | (rx << 8);
          } else if (arg0 === 'ST') {
            // LD ST, Vx -> FX18
            const rx = this.parseRegister(arg1);
            return 0xF018 | (rx << 8);
          } else if (arg0 === 'F') {
            // LD F, Vx -> FX29 (font character sprite)
            const rx = this.parseRegister(arg1);
            return 0xF029 | (rx << 8);
          } else if (arg0 === 'B') {
            // LD B, Vx -> FX33 (BCD representation)
            const rx = this.parseRegister(arg1);
            return 0xF033 | (rx << 8);
          } else if (arg0 === '[I]') {
            // LD [I], Vx -> FX55
            const rx = this.parseRegister(arg1);
            return 0xF055 | (rx << 8);
          }
        }
        throw new Error("Invalid arguments for LD instruction");

      case 'ADD':
        if (len !== 2) throw new Error("ADD takes exactly 2 arguments");
        {
          const arg0 = args[0].toUpperCase();
          const arg1 = args[1].toUpperCase();

          if (arg0 === 'I') {
            // ADD I, Vx -> FX1E
            const rx = this.parseRegister(arg1);
            return 0xF01E | (rx << 8);
          } else if (arg0.startsWith('V')) {
            const rx = this.parseRegister(arg0);
            if (arg1.startsWith('V')) {
              // ADD Vx, Vy -> 8XY4
              const ry = this.parseRegister(arg1);
              return 0x8004 | (rx << 8) | (ry << 4);
            } else {
              // ADD Vx, kk -> 7XKK
              const kk = this.parseNumber(arg1, labels) & 0xFF;
              return 0x7000 | (rx << 8) | kk;
            }
          }
        }
        throw new Error("Invalid arguments for ADD instruction");

      case 'OR':
        if (len !== 2) throw new Error("OR takes exactly 2 register arguments");
        {
          const rx = this.parseRegister(args[0]);
          const ry = this.parseRegister(args[1]);
          return 0x8001 | (rx << 8) | (ry << 4);
        }

      case 'AND':
        if (len !== 2) throw new Error("AND takes exactly 2 register arguments");
        {
          const rx = this.parseRegister(args[0]);
          const ry = this.parseRegister(args[1]);
          return 0x8002 | (rx << 8) | (ry << 4);
        }

      case 'XOR':
        if (len !== 2) throw new Error("XOR takes exactly 2 register arguments");
        {
          const rx = this.parseRegister(args[0]);
          const ry = this.parseRegister(args[1]);
          return 0x8003 | (rx << 8) | (ry << 4);
        }

      case 'SUB':
        if (len !== 2) throw new Error("SUB takes exactly 2 register arguments");
        {
          const rx = this.parseRegister(args[0]);
          const ry = this.parseRegister(args[1]);
          return 0x8005 | (rx << 8) | (ry << 4);
        }

      case 'SHR':
        if (len < 1 || len > 2) throw new Error("SHR takes 1 or 2 arguments");
        {
          const rx = this.parseRegister(args[0]);
          // Standard Chip-8 SHR shifts Vx in-place. Wy is parsed and ignored if provided.
          return 0x8006 | (rx << 8);
        }

      case 'SUBN':
        if (len !== 2) throw new Error("SUBN takes exactly 2 register arguments");
        {
          const rx = this.parseRegister(args[0]);
          const ry = this.parseRegister(args[1]);
          return 0x8007 | (rx << 8) | (ry << 4);
        }

      case 'SHL':
        if (len < 1 || len > 2) throw new Error("SHL takes 1 or 2 arguments");
        {
          const rx = this.parseRegister(args[0]);
          return 0x800E | (rx << 8);
        }

      case 'RND':
        if (len !== 2) throw new Error("RND takes exactly 2 arguments");
        {
          const rx = this.parseRegister(args[0]);
          const kk = this.parseNumber(args[1], labels) & 0xFF;
          return 0xC000 | (rx << 8) | kk;
        }

      case 'DRW':
        if (len !== 3) throw new Error("DRW takes exactly 3 arguments (Vx, Vy, nibble)");
        {
          const rx = this.parseRegister(args[0]);
          const ry = this.parseRegister(args[1]);
          const n = this.parseNumber(args[2], labels) & 0x0F;
          return 0xD000 | (rx << 8) | (ry << 4) | n;
        }

      case 'SKP':
        if (len !== 1) throw new Error("SKP takes exactly 1 register argument");
        {
          const rx = this.parseRegister(args[0]);
          return 0xE09E | (rx << 8);
        }

      case 'SKNP':
        if (len !== 1) throw new Error("SKNP takes exactly 1 register argument");
        {
          const rx = this.parseRegister(args[0]);
          return 0xE0A1 | (rx << 8);
        }

      default:
        return null; // Signals syntax error to caller
    }
  }
}
