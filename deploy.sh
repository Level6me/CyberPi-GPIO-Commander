#!/bin/bash
set -e

DIR="$HOME/rspi_gpio"

mkdir -p $DIR
cd $DIR

# Extract
tar -xzf project.tar.gz

# Setup venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start server
pkill -f 'uvicorn main:app' || true
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
echo "Server started successfully on port 8000"
