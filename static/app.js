let ws = null;
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const headerContainer = document.getElementById('header-container');
const terminalOutput = document.getElementById('terminal-output');
const termInput = document.getElementById('term-input');
const macroStatus = document.getElementById('macro-status');
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnPlay = document.getElementById('btn-play');

// I2C Elements
const btnI2cScan = document.getElementById('btn-i2c-scan');
const spanI2cResult = document.getElementById('i2c-scan-result');
const inputI2cAddr = document.getElementById('i2c-addr');
const inputI2cReg = document.getElementById('i2c-reg');
const inputI2cLen = document.getElementById('i2c-len');
const btnI2cRead = document.getElementById('btn-i2c-read');
const inputI2cPayload = document.getElementById('i2c-payload');
const btnI2cWrite = document.getElementById('btn-i2c-write');

let pinsData = {};
let isRecording = false;
let macroSequence = [];
let macroStartTime = 0;
let oscChart = null;
const maxChartPoints = 40;
const chartColors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

const pinMap = [
    { physical: 1, label: '3.3V', type: 'power-3v' }, { physical: 2, label: '5V', type: 'power-5v' },
    { physical: 3, label: 'GPIO 2 (SDA)', type: 'gpio', bcm: 2 }, { physical: 4, label: '5V', type: 'power-5v' },
    { physical: 5, label: 'GPIO 3 (SCL)', type: 'gpio', bcm: 3 }, { physical: 6, label: 'GND', type: 'gnd' },
    { physical: 7, label: 'GPIO 4', type: 'gpio', bcm: 4 }, { physical: 8, label: 'GPIO 14 (TXD)', type: 'gpio', bcm: 14 },
    { physical: 9, label: 'GND', type: 'gnd' }, { physical: 10, label: 'GPIO 15 (RXD)', type: 'gpio', bcm: 15 },
    { physical: 11, label: 'GPIO 17', type: 'gpio', bcm: 17 }, { physical: 12, label: 'GPIO 18', type: 'gpio', bcm: 18 },
    { physical: 13, label: 'GPIO 27', type: 'gpio', bcm: 27 }, { physical: 14, label: 'GND', type: 'gnd' },
    { physical: 15, label: 'GPIO 22', type: 'gpio', bcm: 22 }, { physical: 16, label: 'GPIO 23', type: 'gpio', bcm: 23 },
    { physical: 17, label: '3.3V', type: 'power-3v' }, { physical: 18, label: 'GPIO 24', type: 'gpio', bcm: 24 },
    { physical: 19, label: 'GPIO 10 (MOSI)', type: 'gpio', bcm: 10 }, { physical: 20, label: 'GND', type: 'gnd' },
    { physical: 21, label: 'GPIO 9 (MISO)', type: 'gpio', bcm: 9 }, { physical: 22, label: 'GPIO 25', type: 'gpio', bcm: 25 },
    { physical: 23, label: 'GPIO 11 (SCLK)', type: 'gpio', bcm: 11 }, { physical: 24, label: 'GPIO 8 (CE0)', type: 'gpio', bcm: 8 },
    { physical: 25, label: 'GND', type: 'gnd' }, { physical: 26, label: 'GPIO 7 (CE1)', type: 'gpio', bcm: 7 },
    { physical: 27, label: 'ID_SD', type: 'gnd' }, { physical: 28, label: 'ID_SC', type: 'gnd' },
    { physical: 29, label: 'GPIO 5', type: 'gpio', bcm: 5 }, { physical: 30, label: 'GND', type: 'gnd' },
    { physical: 31, label: 'GPIO 6', type: 'gpio', bcm: 6 }, { physical: 32, label: 'GPIO 12', type: 'gpio', bcm: 12 },
    { physical: 33, label: 'GPIO 13', type: 'gpio', bcm: 13 }, { physical: 34, label: 'GND', type: 'gnd' },
    { physical: 35, label: 'GPIO 19', type: 'gpio', bcm: 19 }, { physical: 36, label: 'GPIO 16', type: 'gpio', bcm: 16 },
    { physical: 37, label: 'GPIO 26', type: 'gpio', bcm: 26 }, { physical: 38, label: 'GPIO 20', type: 'gpio', bcm: 20 },
    { physical: 39, label: 'GND', type: 'gnd' }, { physical: 40, label: 'GPIO 21', type: 'gpio', bcm: 21 }
];

function initGrid() {
    headerContainer.innerHTML = '';
    pinMap.forEach(pinConf => {
        const row = document.createElement('div');
        const isRightCol = pinConf.physical % 2 === 0;
        row.className = `pin-row ${isRightCol ? 'right-col' : ''}`;
        
        const pinNum = document.createElement('div');
        pinNum.className = 'pin-number';
        pinNum.textContent = pinConf.physical;

        const physicalBox = document.createElement('div');
        physicalBox.className = 'physical-pin';

        const infoCard = document.createElement('div');
        infoCard.className = `pin-info ${pinConf.type}`;
        
        if (pinConf.type === 'gpio') {
            const led = document.createElement('div');
            led.className = 'state-led low';
            led.id = `led-bcm-${pinConf.bcm}`;
            physicalBox.appendChild(led); // Move LED into the physical pin pad

            const labelInput = document.createElement('input');
            labelInput.className = 'pin-label-input';
            labelInput.value = pinConf.label;
            labelInput.id = `label-bcm-${pinConf.bcm}`;
            labelInput.onchange = (e) => sendAction('set_name', pinConf.bcm, { name: e.target.value });
            infoCard.appendChild(labelInput);

            infoCard.classList.add('gpio-active');
            infoCard.id = `info-bcm-${pinConf.bcm}`;
            
            const controls = document.createElement('div');
            controls.className = 'gpio-controls';

            const pwmSlider = document.createElement('input');
            pwmSlider.type = 'range';
            pwmSlider.min = 0; pwmSlider.max = 100; pwmSlider.value = 0;
            pwmSlider.className = 'pwm-slider';
            pwmSlider.id = `pwm-bcm-${pinConf.bcm}`;
            pwmSlider.onchange = (e) => sendAction('set_pwm', pinConf.bcm, { pwm: parseInt(e.target.value) });

            const sw = document.createElement('div');
            sw.className = 'switch-btn';
            sw.id = `sw-bcm-${pinConf.bcm}`;
            const swSlider = document.createElement('div');
            swSlider.className = 'switch-slider';
            sw.appendChild(swSlider);

            const modeBtn = document.createElement('button');
            modeBtn.className = 'mode-btn';
            modeBtn.id = `mode-bcm-${pinConf.bcm}`;
            modeBtn.textContent = 'OUT';

            sw.onclick = () => {
                if (pinsData[pinConf.bcm] && pinsData[pinConf.bcm].mode === 'OUT') {
                    sendAction('toggle', pinConf.bcm);
                }
            };
            modeBtn.onclick = () => {
                const cur = pinsData[pinConf.bcm] ? pinsData[pinConf.bcm].mode : 'OUT';
                let nxt = 'OUT';
                if (cur === 'OUT') nxt = 'IN';
                else if (cur === 'IN') nxt = 'PWM';
                sendAction('set_mode', pinConf.bcm, { mode: nxt });
            };

            controls.appendChild(pwmSlider);
            controls.appendChild(sw);
            controls.appendChild(modeBtn);
            infoCard.appendChild(controls);
        } else {
            const label = document.createElement('div');
            label.className = 'pin-label';
            label.textContent = pinConf.label;
            infoCard.appendChild(label);
        }

        row.appendChild(pinNum);
        row.appendChild(physicalBox);
        row.appendChild(infoCard);
        headerContainer.appendChild(row);
    });
}

function initChart() {
    const ctx = document.getElementById('osc-chart').getContext('2d');
    oscChart = new Chart(ctx, {
        type: 'line',
        data: { labels: Array(maxChartPoints).fill(''), datasets: [] },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: { y: { min: -0.5, max: 2.0, display: false }, x: { display: false } },
            plugins: { legend: { display: true, position: 'right', labels: { color: '#c7903c', font: {family: 'Share Tech Mono', size: 10}, boxWidth: 10 } } }
        }
    });

    setInterval(() => {
        let inputPins = [];
        for (let bcm in pinsData) {
            if (pinsData[bcm].mode === 'IN' || pinsData[bcm].mode === 'PWM') inputPins.push(pinsData[bcm]);
        }
        
        oscChart.data.datasets = oscChart.data.datasets.filter(ds => inputPins.find(p => p.name === ds.label));
        
        inputPins.forEach((pin, i) => {
            let ds = oscChart.data.datasets.find(d => d.label === pin.name);
            if (!ds) {
                ds = {
                    label: pin.name, data: Array(maxChartPoints).fill(0),
                    borderColor: chartColors[i % chartColors.length], borderWidth: 1.5, pointRadius: 0, stepped: true
                };
                oscChart.data.datasets.push(ds);
            }
            let val = pin.mode === 'PWM' ? (pin.pwm / 100.0) : pin.state;
            ds.data.push(val);
            if (ds.data.length > maxChartPoints) ds.data.shift();
        });
        
        oscChart.update();
    }, 150);
}

function logToTerminal(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        statusDot.className = 'smd-led online';
        statusText.textContent = 'LINK: ONLINE';
        logToTerminal('SYS: WebSocket Connection Established.');
    };

    ws.onclose = () => {
        statusDot.className = 'smd-led offline';
        statusText.textContent = 'LINK: OFFLINE';
        logToTerminal('SYS: WebSocket Disconnected. Retrying...');
        setTimeout(connect, 2000);
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'init' || message.type === 'update_all') {
            message.data.forEach(pin => updatePin(pin));
        } else if (message.type === 'update_pin') {
            updatePin(message.data);
        } else if (message.type === 'log') {
            logToTerminal(message.msg);
        } else if (message.type === 'i2c_scan_result') {
            if (message.data.error) {
                spanI2cResult.textContent = `Error: ${message.data.error}`;
            } else if (message.data.devices.length > 0) {
                spanI2cResult.textContent = `Found: ${message.data.devices.join(', ')}`;
            } else {
                spanI2cResult.textContent = `No devices found`;
            }
            btnI2cScan.disabled = false;
            btnI2cScan.textContent = "📡 SCAN BUS";
        }
    };
}

function updatePin(pin) {
    pinsData[pin.pin] = pin;
    const led = document.getElementById(`led-bcm-${pin.pin}`);
    const sw = document.getElementById(`sw-bcm-${pin.pin}`);
    const modeBtn = document.getElementById(`mode-bcm-${pin.pin}`);
    const pwm = document.getElementById(`pwm-bcm-${pin.pin}`);
    const label = document.getElementById(`label-bcm-${pin.pin}`);

    if (led) {
        if (pin.mode === 'PWM') {
            led.style.boxShadow = pin.pwm > 0 ? `0 0 ${pin.pwm/3 + 5}px var(--led-on-blue)` : 'none';
            led.style.background = pin.pwm > 0 ? 'var(--led-on-blue)' : '';
            led.style.opacity = pin.pwm > 0 ? '1' : '0.2';
            led.className = 'state-led pwm-high';
        } else {
            led.style = '';
            led.className = `state-led ${pin.state ? 'high' : 'low'}`;
        }
    }
    
    if (sw) sw.className = `switch-btn ${pin.state || pin.pwm>0 ? 'active' : ''} ${pin.mode === 'IN' ? 'disabled' : ''}`;
    if (modeBtn) modeBtn.textContent = pin.mode;
    if (pwm && document.activeElement !== pwm) pwm.value = pin.pwm;
    if (label && document.activeElement !== label) label.value = pin.name || `GPIO ${pin.pin}`;
}

function sendAction(action, pinNum, extra = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = { action, pin: pinNum, ...extra };
        ws.send(JSON.stringify(payload));
        
        if (isRecording) {
            const delay = Date.now() - macroStartTime;
            macroSequence.push({ delay, payload });
            macroStatus.textContent = `REC: ${macroSequence.length} events...`;
        }
    }
}

// I2C Handlers
btnI2cScan.onclick = () => {
    btnI2cScan.disabled = true;
    btnI2cScan.textContent = "SCANNING...";
    spanI2cResult.textContent = "Please wait...";
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({action: 'scan_i2c'}));
};
btnI2cRead.onclick = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({action: 'read_i2c', address: inputI2cAddr.value, register: inputI2cReg.value, length: inputI2cLen.value}));
    }
};
btnI2cWrite.onclick = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({action: 'write_i2c', address: inputI2cAddr.value, register: inputI2cReg.value, payload: inputI2cPayload.value}));
    }
};

// Macros
btnRecord.onclick = () => {
    isRecording = true; macroSequence = []; macroStartTime = Date.now();
    btnRecord.classList.add('hidden'); btnStop.classList.remove('hidden');
    macroStatus.textContent = 'RECORDING...'; macroStatus.style.color = 'red';
    logToTerminal('MACRO: Recording started.');
};

btnStop.onclick = () => {
    isRecording = false; btnRecord.classList.remove('hidden'); btnStop.classList.add('hidden');
    macroStatus.textContent = `SAVED (${macroSequence.length} events)`; macroStatus.style.color = '#888';
    logToTerminal(`MACRO: Recording stopped. ${macroSequence.length} events saved.`);
};

btnPlay.onclick = () => {
    if (macroSequence.length === 0) return logToTerminal('MACRO: No events to play.');
    logToTerminal('MACRO: Playback started...');
    macroStatus.textContent = 'PLAYING...'; macroStatus.style.color = '#10b981';
    
    macroSequence.forEach(evt => {
        setTimeout(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(evt.payload)); }, evt.delay);
    });
    
    const maxDelay = macroSequence.length > 0 ? macroSequence[macroSequence.length - 1].delay : 0;
    setTimeout(() => {
        macroStatus.textContent = `READY.`; macroStatus.style.color = '#888';
        logToTerminal('MACRO: Playback finished.');
    }, maxDelay + 100);
};

termInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        logToTerminal(`> ${this.value}`);
        if (this.value.toLowerCase() === 'clear') terminalOutput.innerHTML = '';
        else logToTerminal(`ERR: Command not recognized.`);
        this.value = '';
    }
});

initGrid();
initChart();
connect();
