#!/bin/bash
# -------------------------------------------------------------
# 赛博树莓派引脚控制台 - 远程部署脚本示例
# 请复制此文件为 deploy_with_sshpass.sh 并修改下方的连接信息
# -------------------------------------------------------------

IP="192.168.1.100"       # 树莓派 IP 地址
USER="pi"                # 树莓派 SSH 用户名
PASS="your_password"     # 树莓派 SSH 密码
REMOTE_DIR="~/cyberpi_gpio"

export SSHPASS=$PASS
SSH_CMD="sshpass -e ssh -o StrictHostKeyChecking=no"
SCP_CMD="sshpass -e scp -o StrictHostKeyChecking=no"

echo "1. 打包本地代码..."
tar -czf project.tar.gz main.py static requirements.txt deploy.sh

echo "2. 创建远程目录..."
$SSH_CMD $USER@$IP "mkdir -p $REMOTE_DIR"

echo "3. SCP 上传代码包和脚本..."
$SCP_CMD project.tar.gz $USER@$IP:$REMOTE_DIR/
$SCP_CMD deploy.sh $USER@$IP:$REMOTE_DIR/

echo "4. 执行远程部署脚本..."
$SSH_CMD $USER@$IP "bash $REMOTE_DIR/deploy.sh"

echo "5. 检查服务是否启动..."
$SSH_CMD $USER@$IP "curl -s http://127.0.0.1:8000 || echo 'FAILED'"

rm project.tar.gz
echo "--- 部署脚本完全结束 ---"
