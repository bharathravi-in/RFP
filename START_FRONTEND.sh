#!/bin/bash

# Start Frontend Server

echo "Starting RFP Frontend Application..."
echo "====================================="

cd "$(dirname "$0")/frontend"

echo "Installing dependencies (if needed)..."
npm install --silent

echo "✓ Dependencies ready"
echo ""
echo "Starting development server on http://localhost:5173"
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
