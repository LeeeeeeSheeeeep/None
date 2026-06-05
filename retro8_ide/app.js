// Retro-8 App Coordinator
document.addEventListener('DOMContentLoaded', () => {
  // 1. Instantiate Core Components
  const emulator = new Chip8();
  const assembler = new Assembler();

  // 2. DOM Elements Selection
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  
  const btnPlay = document.getElementById('btn-play');
  const btnStep = document.getElementById('btn-step');
  const btnReset = document.getElementById('btn-reset');
  const btnMute = document.getElementById('btn-mute');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  const romSelect = document.getElementById('rom-select');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  
  const cpuIndicator = document.getElementById('cpu-status-indicator');
  const cpuText = document.getElementById('cpu-status-text');
  
  const regI = document.getElementById('reg-i');
  const regPC = document.getElementById('reg-pc');
  const regSP = document.getElementById('reg-sp');
  const regTimers = document.getElementById('reg-timers');
  
  const disasmContainer = document.getElementById('disasm-container');
  const memoryGrid = document.getElementById('memory-grid-container');
  const memSearch = document.getElementById('mem-search');
  
  const templateSelect = document.getElementById('template-select');
  const editor = document.getElementById('assembly-editor');
  const btnCompile = document.getElementById('btn-compile');
  const btnExport = document.getElementById('btn-export');
  const btnClearCode = document.getElementById('btn-clear-code');
  const consoleLog = document.getElementById('console-log');
  const virtualKeypad = document.getElementById('virtual-keypad');

  // 3. Execution Settings & State
  let isRunning = false;
  let animationFrameId = null;
  let emulationSpeed = parseInt(speedSlider.value, 10); // Hz (cycles per second)
  let lastStateUpdate = 0;
  
  // Custom screen pixel decay array for phosphor CRT effect
  const pixelIntensity = new Float32Array(64 * 32);

  // Keyboard layout map: QWERTY -> CHIP-8 Keypad
  const KEY_MAP = {
    '1': 0x1, '2': 0x2, '3': 0x3, '4': 0xC,
    'q': 0x4, 'w': 0x5, 'e': 0x6, 'r': 0xD,
    'a': 0x7, 's': 0x8, 'd': 0x9, 'f': 0xE,
    'z': 0xA, 'x': 0x0, 'c': 0xB, 'v': 0xF,
    'Q': 0x4, 'W': 0x5, 'E': 0x6, 'R': 0xD,
    'A': 0x7, 'S': 0x8, 'D': 0x9, 'F': 0xE,
    'Z': 0xA, 'X': 0x0, 'C': 0xB, 'V': 0xF
  };

  // 4. Keyboard Input Binding
  window.addEventListener('keydown', (e) => {
    // Prevent scrolling with Space/Arrows inside emulator
    if (e.key === ' ' && document.activeElement !== editor) {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (e.key === 'F10') {
      e.preventDefault();
      stepCpu();
      return;
    }

    const mappedKey = KEY_MAP[e.key];
    if (mappedKey !== undefined) {
      emulator.keys[mappedKey] = 1;
      highlightKey(mappedKey, true);
    }
  });

  window.addEventListener('keyup', (e) => {
    const mappedKey = KEY_MAP[e.key];
    if (mappedKey !== undefined) {
      emulator.keys[mappedKey] = 0;
      highlightKey(mappedKey, false);
    }
  });

  // UI Key Highlighter
  function highlightKey(keyIndex, isPressed) {
    const keyElement = virtualKeypad.querySelector(`[data-key="0x${keyIndex.toString(16).toUpperCase()}"]`);
    if (keyElement) {
      if (isPressed) {
        keyElement.classList.add('pressed');
      } else {
        keyElement.classList.remove('pressed');
      }
    }
  }

  // Bind Virtual Pad clicks
  virtualKeypad.querySelectorAll('.key-btn').forEach(btn => {
    const keyVal = parseInt(btn.getAttribute('data-key'), 16);
    btn.addEventListener('mousedown', () => {
      emulator.keys[keyVal] = 1;
      btn.classList.add('pressed');
    });
    btn.addEventListener('mouseup', () => {
      emulator.keys[keyVal] = 0;
      btn.classList.remove('pressed');
    });
    btn.addEventListener('mouseleave', () => {
      emulator.keys[keyVal] = 0;
      btn.classList.remove('pressed');
    });
  });

  // 5. Visual Rendering Engine
  function drawDisplay() {
    const imgData = ctx.createImageData(64, 32);
    const data = imgData.data;

    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = x + y * 64;
        
        // Phosphor decay logic
        if (emulator.display[idx] === 1) {
          pixelIntensity[idx] = 1.0; // Fully bright
        } else {
          pixelIntensity[idx] = Math.max(0, pixelIntensity[idx] - 0.08); // Decays
        }

        const intensity = pixelIntensity[idx];
        const pIdx = idx * 4;
        
        if (intensity > 0) {
          data[pIdx] = 0;     // R
          data[pIdx + 1] = 255; // G
          data[pIdx + 2] = 196; // B
          data[pIdx + 3] = intensity * 255; // A
        } else {
          // Background color #020305
          data[pIdx] = 2;
          data[pIdx + 1] = 3;
          data[pIdx + 2] = 5;
          data[pIdx + 3] = 255;
        }
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  }

  // 6. Game loop driver
  function loop(timestamp) {
    if (!isRunning) return;

    // Standard timing: timers run at 60Hz. We tick them once per animation frame (approx 60fps)
    emulator.tickTimers();

    // Perform instructions depending on frequency (Hz)
    // 60 frames per second, so we execute cyclesPerFrame = speed / 60
    const cyclesPerFrame = Math.max(1, Math.round(emulationSpeed / 60));
    
    for (let c = 0; c < cyclesPerFrame; c++) {
      emulator.step();
    }

    // Render screen
    drawDisplay();

    // Slower UI status rendering to prevent DOM layout lag
    if (timestamp - lastStateUpdate > 120) { // Approx 8Hz update rate
      updateDiagnosticUI();
      lastStateUpdate = timestamp;
    }

    animationFrameId = requestAnimationFrame(loop);
  }

  // Toggle run state
  function togglePlay() {
    if (isRunning) {
      // Pause
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      btnPlay.innerHTML = '<span>▶</span> 运行';
      btnPlay.classList.remove('btn-accent');
      btnPlay.classList.add('btn-primary');
      cpuIndicator.classList.remove('running');
      cpuText.textContent = '已暂停';
      logToConsole('模拟器已暂停。');
      updateDiagnosticUI();
    } else {
      // Run
      isRunning = true;
      btnPlay.innerHTML = '<span>⏸</span> 暂停';
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-accent');
      cpuIndicator.classList.add('running');
      cpuText.textContent = '运行中';
      logToConsole('模拟器运行中...');
      animationFrameId = requestAnimationFrame(loop);
    }
  }

  // Debugger single step
  function stepCpu() {
    if (isRunning) togglePlay(); // Pause if running

    const result = emulator.step();
    drawDisplay();
    updateDiagnosticUI();
    logToConsole(`单步执行: 0x${result.opcode.toString(16).toUpperCase().padStart(4, '0')} - ${result.desc}`);
  }

  // Reset simulator
  function resetCpu() {
    const wasRunning = isRunning;
    if (isRunning) togglePlay();
    
    emulator.reset();
    pixelIntensity.fill(0);
    drawDisplay();
    
    // Reload ROM selection if active
    if (romSelect.value) {
      loadPreloadedROM(romSelect.value);
    } else if (btnCompile.dataset.compiledBytes) {
      const bytes = new Uint8Array(btnCompile.dataset.compiledBytes.split(',').map(Number));
      emulator.loadROM(bytes);
      logToConsole("重置模拟器，已重新载入编译后的汇编二进制文件。");
    } else {
      logToConsole("模拟器已重置，无可用 ROM，内存已清空。");
    }

    if (wasRunning) togglePlay();
    else updateDiagnosticUI();
  }

  // 7. Update UI Diagnostics
  const regCards = [];
  for (let idx = 0; idx < 16; idx++) {
    regCards.push(document.getElementById(`reg-v${idx.toString(16)}`));
  }
  const oldRegVals = new Uint8Array(16);

  function updateDiagnosticUI() {
    // 1. Update Register Values
    for (let idx = 0; idx < 16; idx++) {
      const val = emulator.v[idx];
      const card = regCards[idx];
      const valHex = val.toString(16).toUpperCase().padStart(2, '0');
      
      card.querySelector('.reg-val').textContent = valHex;
      
      // Visual flash animation if value changes
      if (val !== oldRegVals[idx]) {
        card.classList.add('updated');
        setTimeout(() => card.classList.remove('updated'), 300);
        oldRegVals[idx] = val;
      }
    }

    // Index & PC registers
    regI.querySelector('.reg-val').textContent = emulator.i.toString(16).toUpperCase().padStart(4, '0');
    regPC.querySelector('.reg-val').textContent = emulator.pc.toString(16).toUpperCase().padStart(4, '0');
    regSP.querySelector('.reg-val').textContent = emulator.sp.toString(16).toUpperCase().padStart(2, '0');
    regTimers.querySelector('.reg-val').textContent = `${emulator.delayTimer} / ${emulator.soundTimer}`;

    // 2. Update Disassembler view (disassembles current and surrounding instructions)
    disasmContainer.innerHTML = '';
    const startPC = Math.max(0x200, emulator.pc - 4);
    
    for (let addr = startPC; addr < Math.min(4096, emulator.pc + 10); addr += 2) {
      const isCurrent = addr === emulator.pc;
      const op = (emulator.memory[addr] << 8) | emulator.memory[addr + 1];
      const decoded = disassembleOpcode(op);
      
      const lineDiv = document.createElement('div');
      lineDiv.className = `disasm-line ${isCurrent ? 'active' : ''}`;
      
      lineDiv.innerHTML = `
        <span class="disasm-addr">${addr.toString(16).toUpperCase().padStart(4, '0')}</span>
        <span class="disasm-code">${op.toString(16).toUpperCase().padStart(4, '0')}</span>
        <span class="disasm-inst">${decoded}</span>
      `;
      disasmContainer.appendChild(lineDiv);
    }

    // 3. Highlight Memory Visualizer
    updateMemoryVisualizer();
  }

  // 8. Memory visualizer rendering
  function initMemoryVisualizer() {
    memoryGrid.innerHTML = '';
    for (let addr = 0x200; addr < 0x200 + 192; addr++) { // Display 192 cells around ROM start
      const cell = document.createElement('div');
      cell.className = 'mem-cell';
      cell.id = `mem-cell-${addr}`;
      cell.textContent = '00';
      cell.title = `Address: 0x${addr.toString(16).toUpperCase()}`;
      memoryGrid.appendChild(cell);
    }
  }

  function updateMemoryVisualizer() {
    // Only update visible range to save processing power
    const cells = memoryGrid.querySelectorAll('.mem-cell');
    cells.forEach(cell => {
      const addr = parseInt(cell.id.replace('mem-cell-', ''), 10);
      const val = emulator.memory[addr];
      cell.textContent = val.toString(16).toUpperCase().padStart(2, '0');
      
      // Reset classes
      cell.className = 'mem-cell';
      if (val !== 0) cell.classList.add('has-data');
      
      if (addr === emulator.pc) {
        cell.classList.add('active-pc');
      } else if (addr === emulator.i) {
        cell.classList.add('active-i');
      }
    });
  }

  // Handle jump scroll inside memory visualizer
  memSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const hex = memSearch.value.trim();
      const addr = parseInt(hex, 16);
      if (!isNaN(addr) && addr >= 0 && addr < 4096) {
        logToConsole(`内存跳转到: 0x${addr.toString(16).toUpperCase()}`);
        
        // Re-generate cells around search target
        memoryGrid.innerHTML = '';
        const startAddr = Math.max(0, addr - 96);
        for (let a = startAddr; a < Math.min(4096, startAddr + 192); a++) {
          const cell = document.createElement('div');
          cell.className = 'mem-cell';
          cell.id = `mem-cell-${a}`;
          cell.textContent = emulator.memory[a].toString(16).toUpperCase().padStart(2, '0');
          cell.title = `Address: 0x${a.toString(16).toUpperCase()}`;
          
          if (a === addr) cell.classList.add('highlighted');
          memoryGrid.appendChild(cell);
        }
        updateMemoryVisualizer();
      } else {
        logToConsole("无效的十六进制内存地址！", "error");
      }
    }
  });

  // 9. Logger tool
  function logToConsole(text, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `console-entry ${type}`;
    entry.textContent = `> ${text}`;
    consoleLog.appendChild(entry);
    
    // Auto scroll to bottom
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  // 10. Load ROM Handlers
  function loadPreloadedROM(romKey) {
    if (isRunning) togglePlay();

    const romBytes = PRELOADED_ROMS[romKey];
    if (romBytes) {
      emulator.loadROM(romBytes);
      btnCompile.removeAttribute('data-compiled-bytes'); // Clear compiler binary
      logToConsole(`成功载入内置游戏 [${romKey.toUpperCase()}] (${romBytes.length} 字节)。`);
      drawDisplay();
      updateDiagnosticUI();
    }
  }

  romSelect.addEventListener('change', () => {
    if (romSelect.value) {
      loadPreloadedROM(romSelect.value);
    }
  });

  // Speed slider binding
  speedSlider.addEventListener('input', () => {
    emulationSpeed = parseInt(speedSlider.value, 10);
    speedVal.textContent = `${emulationSpeed} Hz`;
  });

  // Mute sound toggle
  btnMute.addEventListener('click', () => {
    const isMuted = !emulator.isMuted;
    emulator.setMute(isMuted);
    btnMute.textContent = isMuted ? '🔇 声音: 禁用' : '🔊 声音: 开启';
    logToConsole(isMuted ? '已静音声音合成器。' : '声音合成器已开启。');
  });

  // Play controls
  btnPlay.addEventListener('click', togglePlay);
  btnStep.addEventListener('click', stepCpu);
  btnReset.addEventListener('click', resetCpu);

  // 11. Drag and Drop local ROM file
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
      loadLocalROMFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      loadLocalROMFile(fileInput.files[0]);
    }
  });

  function loadLocalROMFile(file) {
    if (isRunning) togglePlay();

    const reader = new FileReader();
    reader.onload = function(event) {
      const buffer = event.target.result;
      const romBytes = new Uint8Array(buffer);
      
      emulator.loadROM(romBytes);
      romSelect.value = ''; // Deselect built-in dropdown
      btnCompile.removeAttribute('data-compiled-bytes'); // Clear compiler cache
      
      logToConsole(`成功载入本地文件 [${file.name}] (${romBytes.length} 字节)。`);
      drawDisplay();
      updateDiagnosticUI();
    };
    reader.readAsArrayBuffer(file);
  }

  // 12. Code Assembler Editor Interactions
  templateSelect.addEventListener('change', () => {
    const key = templateSelect.value;
    if (key && assembler.templates[key]) {
      editor.value = assembler.templates[key];
      logToConsole(`已载入代码模板: ${templateSelect.options[templateSelect.selectedIndex].text}`);
    }
  });

  btnClearCode.addEventListener('click', () => {
    editor.value = '';
    logToConsole("编辑器内容已清空。");
  });

  // Action: Compile Code
  btnCompile.addEventListener('click', () => {
    const code = editor.value.trim();
    if (!code) {
      logToConsole("编译失败: 编辑器中没有代码！", "error");
      return;
    }

    logToConsole("开始编译代码中...");
    const result = assembler.assemble(code);

    if (result.success) {
      const bytes = result.data;
      logToConsole(`编译成功！生成 ${bytes.length} 字节二进制机器码。`, "success");
      
      // Stop emulator and load compiled bytes
      if (isRunning) togglePlay();
      emulator.loadROM(bytes);
      
      // Store compiled bytes on button to reload on reset
      btnCompile.dataset.compiledBytes = Array.from(bytes).join(',');
      romSelect.value = ''; // Deselect dropdowns

      drawDisplay();
      updateDiagnosticUI();
      logToConsole("成功把编译后的机器码装载进 CPU 内存 (0x200)，准备执行！", "success");
    } else {
      logToConsole("编译失败！检测到以下错误:", "error");
      result.errors.forEach(err => logToConsole(err, "error"));
    }
  });

  // Action: Export binary download
  btnExport.addEventListener('click', () => {
    const code = editor.value.trim();
    if (!code) {
      logToConsole("导出失败: 编辑器中没有代码！", "error");
      return;
    }

    const result = assembler.assemble(code);
    if (result.success) {
      const blob = new Blob([result.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'retro8_program.ch8';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      logToConsole("二进制程序已下载: retro8_program.ch8", "success");
    } else {
      logToConsole("无法导出: 编译过程中存在错误！", "error");
    }
  });

  // 13. Minimal Disassembler implementation for debugging panel
  function disassembleOpcode(op) {
    if (op === 0) return 'NOP (0x0000)';

    const nnn = op & 0x0FFF;
    const n = op & 0x000F;
    const x = (op & 0x0F00) >> 8;
    const y = (op & 0x00F0) >> 4;
    const kk = op & 0x00FF;

    const rx = 'V' + x.toString(16).toUpperCase();
    const ry = 'V' + y.toString(16).toUpperCase();
    const hexNnn = '0x' + nnn.toString(16).toUpperCase();
    const hexKk = '0x' + kk.toString(16).toUpperCase();

    switch (op & 0xF000) {
      case 0x0000:
        if (op === 0x00E0) return 'CLS';
        if (op === 0x00EE) return 'RET';
        return `SYS ${hexNnn}`;
      case 0x1000: return `JP ${hexNnn}`;
      case 0x2000: return `CALL ${hexNnn}`;
      case 0x3000: return `SE ${rx}, ${hexKk}`;
      case 0x4000: return `SNE ${rx}, ${hexKk}`;
      case 0x5000: return `SE ${rx}, ${ry}`;
      case 0x6000: return `LD ${rx}, ${hexKk}`;
      case 0x7000: return `ADD ${rx}, ${hexKk}`;
      case 0x8000:
        switch (n) {
          case 0x0: return `LD ${rx}, ${ry}`;
          case 0x1: return `OR ${rx}, ${ry}`;
          case 0x2: return `AND ${rx}, ${ry}`;
          case 0x3: return `XOR ${rx}, ${ry}`;
          case 0x4: return `ADD ${rx}, ${ry}`;
          case 0x5: return `SUB ${rx}, ${ry}`;
          case 0x6: return `SHR ${rx}`;
          case 0x7: return `SUBN ${rx}, ${ry}`;
          case 0x8: return `Unknown 8-op`;
          case 0xE: return `SHL ${rx}`;
        }
        break;
      case 0x9000: return `SNE ${rx}, ${ry}`;
      case 0xA000: return `LD I, ${hexNnn}`;
      case 0xB000: return `JP V0, ${hexNnn}`;
      case 0xC000: return `RND ${rx}, ${hexKk}`;
      case 0xD000: return `DRW ${rx}, ${ry}, ${n}`;
      case 0xE000:
        if (kk === 0x9E) return `SKP ${rx}`;
        if (kk === 0xA1) return `SKNP ${rx}`;
        break;
      case 0xF000:
        switch (kk) {
          case 0x07: return `LD ${rx}, DT`;
          case 0x0A: return `LD ${rx}, K`;
          case 0x15: return `LD DT, ${rx}`;
          case 0x18: return `LD ST, ${rx}`;
          case 0x1E: return `ADD I, ${rx}`;
          case 0x29: return `LD F, ${rx}`;
          case 0x33: return `LD B, ${rx}`;
          case 0x55: return `LD [I], ${rx}`;
          case 0x65: return `LD ${rx}, [I]`;
        }
        break;
    }
    return `DW 0x${op.toString(16).toUpperCase()}`;
  }

  // 14. Initialize Visualizer layout on startup
  initMemoryVisualizer();
  updateDiagnosticUI();
  drawDisplay();
});
