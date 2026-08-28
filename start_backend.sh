#!/bin/bash
echo "Starting Marine Sentinel API Backend..."
cd backend

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Virtual environment 'venv' not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Run backend on port 5001
python3 -m uvicorn app.main:app --reload --port 5001
