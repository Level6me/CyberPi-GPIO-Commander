import pexpect

ip = "10.0.0.2"
user = "jiang"
password = os.environ.get("DEVICE_PASSWORD")

ssh_cmd = f"ssh -o StrictHostKeyChecking=no {user}@{ip} 'cat ~/rspi_gpio/server.log'"
child = pexpect.spawn(ssh_cmd, timeout=30, encoding='utf-8')
try:
    idx = child.expect(["assword:", pexpect.EOF, pexpect.TIMEOUT])
    if idx == 0:
        child.sendline(password)
    child.expect(pexpect.EOF, timeout=30)
    print("Log content:", child.before)
except Exception as e:
    print(f"检查失败: {e}")
