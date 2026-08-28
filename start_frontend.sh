#!/bin/bash
echo "Starting Marine Sentinel React Dashboard..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Frontend node_modules not found. Installing..."
    npm install
fi

# Run frontend using Vite
npm run dev
