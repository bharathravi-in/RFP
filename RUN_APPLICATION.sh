#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     RFP Application Startup Script (Without Docker)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Function to print section headers
print_section() {
    echo ""
    echo -e "${YELLOW}► $1${NC}"
}

# Function to check if a port is in use
check_port() {
    lsof -i ":$1" > /dev/null 2>&1
}

# Function to print success message
success_msg() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error message
error_msg() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
print_section "Checking Prerequisites..."

# Check if PostgreSQL is running
if ! PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1" > /dev/null 2>&1; then
    error_msg "PostgreSQL is not running or database 'autorespond' is not accessible"
    echo "Make sure PostgreSQL is running and database is created"
    exit 1
fi
success_msg "PostgreSQL database is accessible"

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    error_msg "Redis is not running"
    echo "Starting Redis server..."
    redis-server --daemonize yes
    sleep 2
    if ! redis-cli ping > /dev/null 2>&1; then
        error_msg "Failed to start Redis"
        exit 1
    fi
fi
success_msg "Redis server is running"

# Check Node.js
if ! command -v node &> /dev/null; then
    error_msg "Node.js is not installed"
    exit 1
fi
success_msg "Node.js is installed ($(node --version))"

# Check Python
if ! command -v python3 &> /dev/null; then
    error_msg "Python 3 is not installed"
    exit 1
fi
success_msg "Python 3 is installed ($(python3 --version))"

# Check Qdrant (optional)
print_section "Checking Optional Services..."
if ! curl -s http://localhost:6333/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Qdrant vector database is not running (optional)${NC}"
    echo "  If you need knowledge base features, start Qdrant separately"
else
    success_msg "Qdrant vector database is running"
fi

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Function to kill processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down application...${NC}"
    
    # Kill background processes
    jobs -p | xargs -r kill -9 2>/dev/null
    
    echo -e "${GREEN}Application shut down successfully${NC}"
}

trap cleanup EXIT

print_section "Starting Services..."

# Start Backend
echo -e "${BLUE}Starting Backend Server on port 5000...${NC}"
cd "$SCRIPT_DIR/backend"
python3 run.py > "$SCRIPT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
sleep 3

if ! check_port 5000; then
    error_msg "Backend failed to start. Check logs/backend.log"
    cat "$SCRIPT_DIR/logs/backend.log"
    exit 1
fi
success_msg "Backend is running on http://localhost:5000 (PID: $BACKEND_PID)"

# Seed database with initial data
echo -e "${BLUE}Seeding database with initial data...${NC}"
cd "$SCRIPT_DIR/backend"
python3 << 'SEED_EOF' > /dev/null 2>&1
from app import create_app, db
from app.models import seed_section_types

app = create_app()
with app.app_context():
    try:
        seed_section_types(db.session)
        print("✓ Database seeded successfully")
    except Exception as e:
        print(f"Note: Database seeding skipped (likely already seeded)")
SEED_EOF
success_msg "Database initialization complete"

# Start Celery Worker (optional but recommended)
echo -e "${BLUE}Starting Celery Worker...${NC}"
cd "$SCRIPT_DIR/backend"
celery -A app.celery worker -l info > "$SCRIPT_DIR/logs/celery.log" 2>&1 &
CELERY_PID=$!
sleep 2
success_msg "Celery worker is running (PID: $CELERY_PID)"

# Start Frontend
echo -e "${BLUE}Starting Frontend Server on port 5173...${NC}"
cd "$SCRIPT_DIR/frontend"
npm run dev > "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
sleep 5

if ! check_port 5173; then
    error_msg "Frontend failed to start. Check logs/frontend.log"
    cat "$SCRIPT_DIR/logs/frontend.log"
    exit 1
fi
success_msg "Frontend is running on http://localhost:5173 (PID: $FRONTEND_PID)"

print_section "Application is Running!"
echo ""
echo -e "${GREEN}Services Status:${NC}"
echo "  Backend:         http://localhost:5000"
echo "  Frontend:        http://localhost:5173"
echo "  PostgreSQL:      localhost:5432 (autorespond)"
echo "  Redis:           localhost:6379"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  Backend:         $SCRIPT_DIR/logs/backend.log"
echo "  Frontend:        $SCRIPT_DIR/logs/frontend.log"
echo "  Celery:          $SCRIPT_DIR/logs/celery.log"
echo ""
echo -e "${YELLOW}Open your browser and go to:${NC}"
echo -e "  ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}To stop the application, press Ctrl+C${NC}"
echo ""

# Wait for all background processes
wait
