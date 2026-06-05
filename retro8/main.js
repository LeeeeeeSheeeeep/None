const DEMOS = {
    test_draw: `# Simple Drawing Test
# Draws a rectangle
LD V0, 10
LD V1, 10
LD I, sprite
DRW V0, V1, 5
halt:
JP halt

sprite:
DB 255, 129, 129, 129, 255
`,
    bouncing_pixel: `# Bouncing Pixel
# V0 = x, V1 = y
# V2 = dx, V3 = dy
LD V0, 32
LD V1, 16
LD V2, 1
LD V3, 1
LD I, sprite

loop:
  CLS
  DRW V0, V1, 1
  ADD V0, V2
  ADD V1, V3

  # check bounds x
  SE V0, 63
  JP skipX
  LD V2, 255
skipX:
  SE V0, 0
  JP skipX2
  LD V2, 1
skipX2:

  # check bounds y
  SE V1, 31
  JP skipY
  LD V3, 255
skipY:
  SE V1, 0
  JP skipY2
  LD V3, 1
skipY2:

  # delay
  LD V4, 2
  LD DT, V4
wait:
  LD V5, DT
  SE V5, 0
  JP wait

  JP loop

sprite:
  DB 128
`,
    maze: `# Random Maze Generator
# V0 = x, V1 = y
# V2 = rnd value
LD V0, 0
LD V1, 0

loop:
  RND V2, 1
  SE V2, 1
  JP draw_slash
  LD I, backslash
  JP draw
draw_slash:
  LD I, slash
draw:
  DRW V0, V1, 4
  ADD V0, 4
  SE V0, 64
  JP loop
  LD V0, 0
  ADD V1, 4
  SE V1, 32
  JP loop
halt:
  JP halt

slash:
  DB 0x10, 0x20, 0x40, 0x80
backslash:
  DB 0x80, 0x40, 0x20, 0x10
`
};

const KEYMAP = {
    '1': 0x1, '2': 0x2, '3': 0x3, '4': 0xC,
    'q': 0x4, 'w': 0x5, 'e': 0x6, 'r': 0xD,
    'a': 0x7, 's': 0x8, 'd': 0x9, 'f': 0xE,
    'z': 0xA, 'x': 0x0, 'c': 0xB, 'v': 0xF
};

document.addEventListener('DOMContentLoaded', () => {
    const emulator = new Chip8Emulator();
    const assembler = new Chip8Assembler();
    
    // DOM Elements
    const canvas = document.getElementById('display');
    const ctx = canvas.getContext('2d');
    const codeEditor = document.getElementById('code-editor');
    const romSelect = document.getElementById('rom-select');
    const statusText = document.getElementById('assembler-status');
    const speedSlider = document.getElementById('speed-slider');
    
    const regGrid = document.getElementById('registers-grid');
    const regPc = document.getElementById('reg-pc');
    const regI = document.getElementById('reg-i');
    const regSp = document.getElementById('reg-sp');
    const regDt = document.getElementById('reg-dt');
    const regSt = document.getElementById('reg-st');
    const memView = document.getElementById('memory-view');

    // Init UI
    for (let i = 0; i < 16; i++) {
        const div = document.createElement('div');
        div.className = 'reg';
        div.innerHTML = `<span class="label">V${i.toString(16).toUpperCase()}</span><span class="value" id="reg-v${i}">0x00</span>`;
        regGrid.appendChild(div);
    }
    
    codeEditor.value = DEMOS.bouncing_pixel;
    
    let isRunning = false;
    let animationFrameId = null;
    let lastTimerTick = performance.now();

    function updateDebugInfo() {
        for (let i = 0; i < 16; i++) {
            document.getElementById(`reg-v${i}`).textContent = `0x${emulator.v[i].toString(16).padStart(2, '0').toUpperCase()}`;
        }
        regPc.textContent = `0x${emulator.pc.toString(16).padStart(4, '0').toUpperCase()}`;
        regI.textContent = `0x${emulator.i.toString(16).padStart(4, '0').toUpperCase()}`;
        regSp.textContent = `0x${emulator.sp.toString(16).padStart(2, '0').toUpperCase()}`;
        regDt.textContent = `0x${emulator.delayTimer.toString(16).padStart(2, '0').toUpperCase()}`;
        regSt.textContent = `0x${emulator.soundTimer.toString(16).padStart(2, '0').toUpperCase()}`;

        // Memory dump near PC
        let memHtml = '';
        const start = Math.max(0x200, emulator.pc - 16);
        for (let i = start; i < start + 64; i += 2) {
            const isPc = (i === emulator.pc);
            const byte1 = emulator.memory[i].toString(16).padStart(2, '0').toUpperCase();
            const byte2 = emulator.memory[i+1].toString(16).padStart(2, '0').toUpperCase();
            const addr = i.toString(16).padStart(4, '0').toUpperCase();
            memHtml += `<span class="${isPc ? 'pc-line' : ''}">0x${addr}: ${byte1} ${byte2}</span><br>`;
        }
        memView.innerHTML = memHtml;
    }

    function renderDisplay() {
        if (!emulator.drawFlag) return;
        emulator.drawFlag = false;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#4eff8d'; // Neon green
        for (let i = 0; i < 64 * 32; i++) {
            if (emulator.display[i]) {
                const x = (i % 64) * 10;
                const y = Math.floor(i / 64) * 10;
                ctx.fillRect(x, y, 10, 10);
            }
        }
    }

    function runLoop(time) {
        if (!isRunning) return;

        // 60Hz timers
        if (time - lastTimerTick > 16.66) {
            emulator.tickTimers();
            lastTimerTick = time;
        }

        // Instructions per frame based on speed
        const speed = parseInt(speedSlider.value, 10) / 60;
        for (let i = 0; i < speed; i++) {
            if (!isRunning) break;
            try {
                emulator.cycle();
            } catch(e) {
                console.error("Emulator crash:", e);
                isRunning = false;
                statusText.textContent = "EMULATOR CRASHED.";
                statusText.className = 'status-bar error';
            }
        }

        renderDisplay();
        updateDebugInfo();

        animationFrameId = requestAnimationFrame(runLoop);
    }

    function stopLoop() {
        isRunning = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }

    function startLoop() {
        if (isRunning) return;
        isRunning = true;
        emulator.initAudio();
        lastTimerTick = performance.now();
        animationFrameId = requestAnimationFrame(runLoop);
    }

    // Buttons
    document.getElementById('btn-compile-run').addEventListener('click', () => {
        stopLoop();
        try {
            const rom = assembler.compile(codeEditor.value);
            emulator.loadRom(rom);
            statusText.textContent = "COMPILED SUCCESSFULLY. RUNNING...";
            statusText.className = 'status-bar success';
            startLoop();
        } catch (e) {
            statusText.textContent = `ASM ERROR: ${e.message}`;
            statusText.className = 'status-bar error';
        }
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        if (isRunning) {
            stopLoop();
            statusText.textContent = "PAUSED.";
        } else {
            startLoop();
            statusText.textContent = "RUNNING...";
        }
    });

    document.getElementById('btn-step').addEventListener('click', () => {
        stopLoop();
        emulator.cycle();
        renderDisplay();
        updateDebugInfo();
        statusText.textContent = "STEPPING.";
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        stopLoop();
        emulator.reset();
        renderDisplay();
        updateDebugInfo();
        statusText.textContent = "RESET.";
    });
    
    romSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (DEMOS[val]) {
            codeEditor.value = DEMOS[val];
        }
    });

    // Keyboard Input

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (KEYMAP[key] !== undefined) {
            emulator.keys[KEYMAP[key]] = true;
            // Visual feedback
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (KEYMAP[key] !== undefined) {
            emulator.keys[KEYMAP[key]] = false;
        }
    });

    // Initial render
    renderDisplay();
    updateDebugInfo();
});
