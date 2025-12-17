#!/bin/bash

# Start Backend Server

echo "Starting RFP Backend Server..."
echo "================================"

cd "$(dirname "$0")/backend"

# Check if database is accessible
if ! PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1" > /dev/null 2>&1; then
    echo "Error: PostgreSQL database 'autorespond' is not accessible"
    echo "Make sure PostgreSQL is running"
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Warning: Redis is not running, starting it..."
    redis-server --daemonize yes
    sleep 2
fi

echo "✓ Prerequisites met"
echo ""
echo "Starting server on http://localhost:5000"
echo "Press Ctrl+C to stop the server"
echo ""

python3 run.py
