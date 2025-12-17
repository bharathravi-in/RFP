# Quick Start Guide

## 🚀 Run Everything at Once (Recommended)

```bash
cd /home/bharathkumarr/AI-hackathon/RFP-project/V1
./RUN_APPLICATION.sh
```

Then open: **http://localhost:5173**

---

## 🛠️ Run Components Separately

Open 3 terminals in the V1 directory:

### Terminal 1 - Backend
```bash
./START_BACKEND.sh
```
Runs on: http://localhost:5000

### Terminal 2 - Frontend
```bash
./START_FRONTEND.sh
```
Runs on: http://localhost:5173

### Terminal 3 - Celery Worker (Optional)
```bash
./START_CELERY_WORKER.sh
```

---

## ✅ Prerequisites Checklist

- [x] PostgreSQL running with `autorespond` database
- [x] Redis server installed and running
- [x] Python 3 and pip installed
- [x] Node.js and npm installed
- [x] All dependencies installed

Run this to verify everything is ready:

```bash
# Check PostgreSQL
PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "SELECT 1"

# Check Redis
redis-cli ping

# Check Python
python3 --version

# Check Node.js
node --version
```

---

## 📱 Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:5000/api/

---

## 🛑 Stop the Application

Press **Ctrl+C** in the terminal(s) where services are running

---

## 📋 Services Running

| Service | Port | Status |
|---------|------|--------|
| Frontend (Vite) | 5173 | ✅ Development |
| Backend (Flask) | 5000 | ✅ Development |
| PostgreSQL | 5432 | ✅ Database |
| Redis | 6379 | ✅ Cache/Queue |
| Celery | - | ✅ Workers |

---

## 📖 More Help

For detailed setup instructions, see: **RUNNING_APPLICATION.md**

For database setup details, see: **DATABASE_SETUP.md**
