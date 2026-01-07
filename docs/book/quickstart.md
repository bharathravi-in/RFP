# Quick Start

## Prerequisites

- Docker & Docker Compose
- Google Cloud account with Gemini API access
- 8GB+ RAM recommended

## Installation

### 1. Clone Repository
```bash
git clone [repository-url]
cd RFP
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` and add your API key:
```
GOOGLE_API_KEY=your-gemini-api-key
```

### 3. Start Application
```bash
docker compose up -d
```

### 4. Access
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5002 |

## First Steps

1. **Login/Register** - Create your account
2. **Create Project** - Click "New Project"
3. **Upload RFP** - Drag & drop your RFP document
4. **Generate Content** - Click "Generate" on any section
5. **Export** - Download as PDF/DOCX

## Common Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Restart backend
docker compose restart backend

# Stop services
docker compose down
```
