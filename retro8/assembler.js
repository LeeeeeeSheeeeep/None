class AssemblerError extends Error {
    constructor(line, message) {
        super(`Line ${line}: ${message}`);
        this.line = line;
    }
}

class Chip8Assembler {
    constructor() {
        this.labels = {};
    }

    compile(source) {
        this.labels = {};
        const lines = source.split('\n');
        
        // PASS 1: Resolve Labels
        let currentAddress = 0x200;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].split(/[#;]/)[0].trim();
            if (!line) continue;

            if (line.endsWith(':')) {
                const label = line.slice(0, -1).trim();
                this.labels[label] = currentAddress;
            } else {
                // Determine instruction size
                const parts = line.split(/\s+/);
                if (parts[0].toUpperCase() === 'DB') {
                    currentAddress += parts.slice(1).join('').split(',').length;
                } else if (parts[0].toUpperCase() === 'DW') {
                    currentAddress += parts.slice(1).join('').split(',').length * 2;
                } else {
                    currentAddress += 2; // All normal instructions are 2 bytes
                }
            }
        }

        // PASS 2: Generate Bytecode
        const bytecode = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].split(/[#;]/)[0].trim();
            if (!line || line.endsWith(':')) continue;

            try {
                const bytes = this.parseInstruction(line, i + 1);
                for (let b of bytes) bytecode.push(b);
            } catch (err) {
                throw new AssemblerError(i + 1, err.message);
            }
        }

        return new Uint8Array(bytecode);
    }

    parseInstruction(line, lineNumber) {
        // Normalize commas to spaces
        const parts = line.replace(/,/g, ' ').split(/\s+/).filter(p => p.length > 0);
        const op = parts[0].toUpperCase();
        const args = parts.slice(1);

        const parseReg = (arg) => {
            if (!arg) throw new Error("Missing argument");
            arg = arg.toUpperCase();
            if (arg.startsWith('V') && arg.length <= 2) {
                return parseInt(arg.substring(1), 16);
            }
            throw new Error(`Invalid register: ${arg}`);
        };

        const parseVal = (arg) => {
            if (!arg) throw new Error("Missing value");
            if (arg.startsWith('0X')) return parseInt(arg.substring(2), 16);
            if (this.labels[arg] !== undefined) return this.labels[arg];
            return parseInt(arg, 10);
        };

        if (op === 'DB') {
            return args.map(parseVal);
        }
        if (op === 'DW') {
            const words = args.map(parseVal);
            const bytes = [];
            for (let w of words) {
                bytes.push((w & 0xFF00) >> 8, w & 0xFF);
            }
            return bytes;
        }

        let opcode = 0;

        switch (op) {
            case 'CLS': opcode = 0x00E0; break;
            case 'RET': opcode = 0x00EE; break;
            case 'JP': {
                if (args[0].toUpperCase() === 'V0') {
                    opcode = 0xB000 | (parseVal(args[1]) & 0x0FFF);
                } else {
                    opcode = 0x1000 | (parseVal(args[0]) & 0x0FFF);
                }
                break;
            }
            case 'CALL': opcode = 0x2000 | (parseVal(args[0]) & 0x0FFF); break;
            case 'SE': {
                const vx = parseReg(args[0]);
                if (args[1].toUpperCase().startsWith('V')) {
                    opcode = 0x5000 | (vx << 8) | (parseReg(args[1]) << 4);
                } else {
                    opcode = 0x3000 | (vx << 8) | (parseVal(args[1]) & 0xFF);
                }
                break;
            }
            case 'SNE': {
                const vx = parseReg(args[0]);
                if (args[1].toUpperCase().startsWith('V')) {
                    opcode = 0x9000 | (vx << 8) | (parseReg(args[1]) << 4);
                } else {
                    opcode = 0x4000 | (vx << 8) | (parseVal(args[1]) & 0xFF);
                }
                break;
            }
            case 'LD': {
                const dest = args[0].toUpperCase();
                if (dest === 'I') {
                    opcode = 0xA000 | (parseVal(args[1]) & 0x0FFF);
                } else if (dest === 'DT') {
                    opcode = 0xF015 | (parseReg(args[1]) << 8);
                } else if (dest === 'ST') {
                    opcode = 0xF018 | (parseReg(args[1]) << 8);
                } else if (dest === 'F') {
                    opcode = 0xF029 | (parseReg(args[1]) << 8);
                } else if (dest === 'B') {
                    opcode = 0xF033 | (parseReg(args[1]) << 8);
                } else if (dest === '[I]') {
                    opcode = 0xF055 | (parseReg(args[1]) << 8);
                } else if (args[1].toUpperCase() === 'DT') {
                    opcode = 0xF007 | (parseReg(dest) << 8);
                } else if (args[1].toUpperCase() === 'K') {
                    opcode = 0xF00A | (parseReg(dest) << 8);
                } else if (args[1].toUpperCase() === '[I]') {
                    opcode = 0xF065 | (parseReg(dest) << 8);
                } else if (args[1].toUpperCase().startsWith('V')) {
                    opcode = 0x8000 | (parseReg(dest) << 8) | (parseReg(args[1]) << 4);
                } else {
                    opcode = 0x6000 | (parseReg(dest) << 8) | (parseVal(args[1]) & 0xFF);
                }
                break;
            }
            case 'ADD': {
                const dest = args[0].toUpperCase();
                if (dest === 'I') {
                    opcode = 0xF01E | (parseReg(args[1]) << 8);
                } else if (args[1].toUpperCase().startsWith('V')) {
                    opcode = 0x8004 | (parseReg(dest) << 8) | (parseReg(args[1]) << 4);
                } else {
                    opcode = 0x7000 | (parseReg(dest) << 8) | (parseVal(args[1]) & 0xFF);
                }
                break;
            }
            case 'OR': opcode = 0x8001 | (parseReg(args[0]) << 8) | (parseReg(args[1]) << 4); break;
            case 'AND': opcode = 0x8002 | (parseReg(args[0]) << 8) | (parseReg(args[1]) << 4); break;
            case 'XOR': opcode = 0x8003 | (parseReg(args[0]) << 8) | (parseReg(args[1]) << 4); break;
            case 'SUB': opcode = 0x8005 | (parseReg(args[0]) << 8) | (parseReg(args[1]) << 4); break;
            case 'SHR': opcode = 0x8006 | (parseReg(args[0]) << 8); break;
            case 'SUBN': opcode = 0x8007 | (parseReg(args[0]) << 8) | (parseReg(args[1]) << 4); break;
            case 'SHL': opcode = 0x800E | (parseReg(args[0]) << 8); break;
            case 'RND': opcode = 0xC000 | (parseReg(args[0]) << 8) | (parseVal(args[1]) & 0xFF); break;
            case 'DRW': opcode = 0xD000 | (parseReg(args[0]) << 8) | (parseReg(args[1]) << 4) | (parseVal(args[2]) & 0x0F); break;
            case 'SKP': opcode = 0xE09E | (parseReg(args[0]) << 8); break;
            case 'SKNP': opcode = 0xE0A1 | (parseReg(args[0]) << 8); break;
            default:
                throw new Error(`Unknown instruction: ${op}`);
        }

        return [(opcode & 0xFF00) >> 8, opcode & 0x00FF];
    }
}
