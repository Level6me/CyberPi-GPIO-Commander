import pexpect
import os

ip = "10.0.0.2"
user = "jiang"
password = os.environ.get("DEVICE_PASSWORD")
local_dir = "/Users/jiang/github/rspi_gpio_6f2c71"
remote_dir = "~/rspi_gpio"

print("1. 打包本地代码...")
os.system(f"tar -czf project.tar.gz -C {local_dir} main.py static requirements.txt deploy.sh")

print("2. 创建远程目录...")
ssh_cmd_mkdir = f"ssh -o StrictHostKeyChecking=no {user}@{ip} 'mkdir -p {remote_dir}'"
child = pexpect.spawn(ssh_cmd_mkdir, timeout=30, encoding='utf-8')
try:
    idx = child.expect(["assword:", pexpect.EOF, pexpect.TIMEOUT])
    if idx == 0:
        child.sendline(password)
        child.expect(pexpect.EOF)
except Exception as e:
    print(f"mkdir 失败: {e}")

print("3. SCP 上传代码包...")
scp_cmd = f"scp -o StrictHostKeyChecking=no project.tar.gz {user}@{ip}:{remote_dir}/"
child = pexpect.spawn(scp_cmd, timeout=60, encoding='utf-8')
try:
    idx = child.expect(["assword:", pexpect.EOF, pexpect.TIMEOUT])
    if idx == 0:
        child.sendline(password)
        child.expect(pexpect.EOF)
    print("上传完毕。")
except Exception as e:
    print(f"SCP 上传出现问题: {e}")

print("4. 执行远程部署脚本...")
ssh_cmd = f"ssh -o StrictHostKeyChecking=no {user}@{ip} 'bash {remote_dir}/deploy.sh'"
child = pexpect.spawn(ssh_cmd, timeout=300, encoding='utf-8')
try:
    idx = child.expect(["assword:", pexpect.EOF, pexpect.TIMEOUT])
    if idx == 0:
        child.sendline(password)
    child.expect(pexpect.EOF, timeout=300)
    print("部署日志:")
    print(child.before)
    print("--- 部署完成 ---")
except Exception as e:
    print(f"执行部署脚本失败: {e}")
    print(child.before)

os.system("rm project.tar.gz")
