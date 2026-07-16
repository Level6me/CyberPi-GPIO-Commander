import os
import json
import platform
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# 硬件层判断 (兼容 32位 arm 和 64位 aarch64)
IS_RPI = platform.system() == "Linux" and ("arm" in platform.machine().lower() or "aarch64" in platform.machine().lower())
try:
    if IS_RPI:
        from gpiozero import LED, Button, PWMLED
        from smbus2 import SMBus
    else:
        os.environ["GPIOZERO_PIN_FACTORY"] = "mock"
        from gpiozero import LED, Button, PWMLED
        class SMBus:
            def __init__(self, bus): pass
            def read_byte(self, addr): return 0
            def write_byte(self, addr, val): pass
            def read_i2c_block_data(self, addr, reg, length): return [0]*length
            def write_i2c_block_data(self, addr, reg, data): pass
            def close(self): pass
            def __enter__(self): return self
            def __exit__(self, exc_type, exc_val, exc_tb): pass
except Exception as e:
    print(f"Hardware libraries load failed: {e}")

app = FastAPI(title="Rpi GPIO Dashboard PRO")
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse("static/index.html")

AVAILABLE_PINS = [2, 3, 4, 14, 15, 17, 18, 27, 22, 23, 24, 10, 9, 25, 11, 8, 7, 5, 6, 12, 13, 19, 16, 26, 20, 21]
CONFIG_FILE = "config.json"
pins_state = {}
hw_pins = {}

def load_config():
    global pins_state
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                saved = json.load(f)
                for pin_str, conf in saved.items():
                    p = int(pin_str)
                    if p in AVAILABLE_PINS:
                        pins_state[p] = conf
                        pins_state[p]["state"] = 0
                        pins_state[p]["pwm"] = 0
            return
        except: pass
    
    for pin in AVAILABLE_PINS:
        pins_state[pin] = {"pin": pin, "mode": "OUT", "state": 0, "pwm": 0, "name": f"GPIO {pin}"}

def save_config():
    with open(CONFIG_FILE, "w") as f:
        json.dump(pins_state, f)

def bind_hardware_pin(pin_num):
    if pin_num in hw_pins and hw_pins[pin_num] is not None:
        hw_pins[pin_num].close()
        hw_pins[pin_num] = None
        
    mode = pins_state[pin_num]["mode"]
    try:
        if mode == "OUT": hw_pins[pin_num] = LED(pin_num)
        elif mode == "IN": hw_pins[pin_num] = Button(pin_num, pull_up=False)
        elif mode == "PWM": hw_pins[pin_num] = PWMLED(pin_num)
    except Exception as e:
        print(f"Bind Error Pin {pin_num}: {e}")

load_config()
for p in AVAILABLE_PINS:
    bind_hardware_pin(p)

class ConnectionManager:
    def __init__(self): self.active_connections: list[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await websocket.send_json({"type": "init", "data": list(pins_state.values())})
    def disconnect(self, websocket: WebSocket): self.active_connections.remove(websocket)
    async def broadcast_pin_update(self, pin_data):
        for connection in self.active_connections: await connection.send_json({"type": "update_pin", "data": pin_data})
    async def broadcast_terminal_log(self, log_msg):
        for connection in self.active_connections: await connection.send_json({"type": "log", "msg": log_msg})

manager = ConnectionManager()

def scan_i2c_bus(bus_num=1):
    active_devices = []
    try:
        bus = SMBus(bus_num)
        try:
            for addr in range(3, 120):
                try:
                    bus.read_byte(addr)
                    active_devices.append(hex(addr))
                except: pass
        finally:
            bus.close()
    except Exception as e:
        return {"error": str(e)}
    return {"devices": active_devices}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await manager.broadcast_terminal_log("SYS.CONN: Secure channel established.")
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            pin_num = data.get("pin")
            
            await manager.broadcast_terminal_log(f"RECV > ACTION: {action}")
            
            if action == "scan_i2c":
                res = scan_i2c_bus()
                await websocket.send_json({"type": "i2c_scan_result", "data": res})
                await manager.broadcast_terminal_log(f"I2C SCAN: {res}")
            
            elif action == "read_i2c":
                addr = int(data.get("address", "0"), 16)
                reg = int(data.get("register", "0"), 16)
                length = int(data.get("length", 1))
                try:
                    bus = SMBus(1)
                    try:
                        val = bus.read_i2c_block_data(addr, reg, length)
                        hex_val = [hex(v) for v in val]
                        await websocket.send_json({"type": "log", "msg": f"I2C READ SUCCESS [Addr {hex(addr)} Reg {hex(reg)}]: {hex_val}"})
                    finally:
                        bus.close()
                except Exception as e:
                    await websocket.send_json({"type": "log", "msg": f"I2C READ ERROR: {e}"})

            elif action == "write_i2c":
                addr = int(data.get("address", "0"), 16)
                reg = int(data.get("register", "0"), 16)
                payload = [int(x, 16) for x in data.get("payload", "").split(",") if x.strip()]
                try:
                    bus = SMBus(1)
                    try:
                        bus.write_i2c_block_data(addr, reg, payload)
                        await websocket.send_json({"type": "log", "msg": f"I2C WRITE SUCCESS [Addr {hex(addr)} Reg {hex(reg)}]: Sent {len(payload)} bytes"})
                    finally:
                        bus.close()
                except Exception as e:
                    await websocket.send_json({"type": "log", "msg": f"I2C WRITE ERROR: {e}"})

            elif pin_num in pins_state:
                if action == "toggle":
                    current_state = pins_state[pin_num]["state"]
                    new_state = 1 if current_state == 0 else 0
                    pins_state[pin_num]["state"] = new_state
                    if pins_state[pin_num]["mode"] == "OUT":
                        if new_state: hw_pins[pin_num].on()
                        else: hw_pins[pin_num].off()
                elif action == "set_mode":
                    new_mode = data.get("mode", "OUT")
                    pins_state[pin_num]["mode"] = new_mode
                    pins_state[pin_num]["state"] = 0
                    pins_state[pin_num]["pwm"] = 0
                    bind_hardware_pin(pin_num)
                    save_config()
                elif action == "set_pwm":
                    if pins_state[pin_num]["mode"] != "PWM":
                        pins_state[pin_num]["mode"] = "PWM"
                        bind_hardware_pin(pin_num)
                    pwm_val = data.get("pwm", 0)
                    pins_state[pin_num]["pwm"] = pwm_val
                    if hasattr(hw_pins[pin_num], 'value'): hw_pins[pin_num].value = pwm_val / 100.0
                    save_config()
                elif action == "set_name":
                    pins_state[pin_num]["name"] = data.get("name", f"GPIO {pin_num}")
                    save_config()
                
                await manager.broadcast_pin_update(pins_state[pin_num])
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)

async def poll_input_pins():
    while True:
        await asyncio.sleep(0.1)
        for pin_num, hw in hw_pins.items():
            if pins_state[pin_num]["mode"] == "IN" and hw is not None:
                current_hw_state = 1 if hw.is_pressed else 0
                if current_hw_state != pins_state[pin_num]["state"]:
                    pins_state[pin_num]["state"] = current_hw_state
                    await manager.broadcast_pin_update(pins_state[pin_num])

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(poll_input_pins())
