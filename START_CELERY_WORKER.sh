#!/bin/bash

# Start Celery Worker

echo "Starting RFP Celery Worker..."
echo "=============================="

cd "$(dirname "$0")/backend"

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Error: Redis is not running"
    echo "Please start Redis first: redis-server --daemonize yes"
    exit 1
fi

echo "✓ Redis is running"
echo ""
echo "Starting Celery worker..."
echo "Press Ctrl+C to stop the worker"
echo ""

celery -A app.celery worker -l info
