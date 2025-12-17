# Running RFP Application Without Docker

This guide explains how to run the RFP application locally on your machine without using Docker.

## Prerequisites

Make sure you have the following installed:

- ✅ PostgreSQL (running with `autorespond` database)
- ✅ Redis server
- ✅ Python 3.8+
- ✅ Node.js 14+
- ✅ npm or yarn

## Quick Start (All-in-One)

The easiest way to start the application is using the automated startup script:

```bash
cd /home/bharathkumarr/AI-hackathon/RFP-project/V1
./RUN_APPLICATION.sh
```

This will:
1. Check all prerequisites
2. Start PostgreSQL connection
3. Start Redis server
4. Start Backend server (port 5000)
5. Start Celery worker (background tasks)
6. Start Frontend server (port 5173)

Once started, open your browser and go to: **http://localhost:5173**

## Individual Component Startup

If you prefer to run components separately in different terminals:

### Terminal 1: Start Backend Server

```bash
cd /home/bharathkumarr/AI-hackathon/RFP-project/V1
./START_BACKEND.sh
```

Backend will be running on: **http://localhost:5000**

### Terminal 2: Start Frontend Server

```bash
cd /home/bharathkumarr/AI-hackathon/RFP-project/V1
./START_FRONTEND.sh
```

Frontend will be running on: **http://localhost:5173**

### Terminal 3: Start Celery Worker (Optional but Recommended)

```bash
cd /home/bharathkumarr/AI-hackathon/RFP-project/V1
./START_CELERY_WORKER.sh
```

## Manual Setup Steps

### 1. Start PostgreSQL Database

PostgreSQL should already be running. Verify:

```bash
PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1"
```

### 2. Start Redis Server

```bash
redis-server --daemonize yes
```

Verify it's running:

```bash
redis-cli ping
# Should return: PONG
```

### 3. Install Backend Dependencies

```bash
cd backend
pip3 install -r requirements.txt
```

### 4. Start Backend Server

```bash
cd backend
python3 run.py
```

Server starts on: **http://localhost:5000**

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 6. Start Frontend Development Server

```bash
cd frontend
npm run dev
```

Server starts on: **http://localhost:5173**

### 7. Start Celery Worker (Optional)

In another terminal:

```bash
cd backend
celery -A app.celery worker -l info
```

## Configuration

All configuration is stored in `backend/.env`. Key settings:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autorespond

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Qdrant Vector Database (optional)
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Google AI
GOOGLE_API_KEY=your_api_key_here
GOOGLE_MODEL=gemini-2.5-flash-native-audio-dialog
```

## Troubleshooting

### Backend won't start
- Check if port 5000 is already in use: `lsof -i :5000`
- Verify PostgreSQL is running: `PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1"`
- Check logs: `cat logs/backend.log`

### Frontend won't start
- Check if port 5173 is already in use: `lsof -i :5173`
- Clear node_modules: `rm -rf frontend/node_modules && npm install`
- Check Node.js version: `node --version` (should be 14+)

### Redis connection error
- Start Redis: `redis-server --daemonize yes`
- Verify: `redis-cli ping` (should return PONG)

### Database errors
- Verify database exists: `PGPASSWORD=postgres psql -U postgres -h localhost -c "\l"`
- Check connection: `PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1"`

### Qdrant not available
Qdrant is optional for knowledge base features. If not needed, ignore warnings about it.

## Services Status

Check if services are running:

```bash
# PostgreSQL
PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1"

# Redis
redis-cli ping

# Backend
curl http://localhost:5000

# Frontend
curl http://localhost:5173
```

## Logs

When using the all-in-one startup script, logs are saved to:

- `logs/backend.log` - Backend server logs
- `logs/frontend.log` - Frontend development server logs
- `logs/celery.log` - Celery worker logs

## Stop the Application

### If using all-in-one script
Press **Ctrl+C** to stop all services

### If running components separately
Press **Ctrl+C** in each terminal

## Building for Production

### Build Frontend

```bash
cd frontend
npm run build
```

This creates optimized files in `frontend/dist/`

### Run Backend in Production

```bash
cd backend
gunicorn -b 0.0.0.0:5000 app:app
```

## Environment Variables

Edit `backend/.env` to configure:

- Database credentials
- Google API key for AI features
- Qdrant configuration
- Redis connection
- Upload folder location

## Support

For issues or questions, check:
1. Backend logs: `logs/backend.log`
2. Frontend console: Browser DevTools (F12)
3. Celery logs: `logs/celery.log`
