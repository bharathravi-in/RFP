# AutoRespond AI

AI-Powered RFP, RFI & Security Questionnaire Automation Platform

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Running with Docker

```bash
# Clone and navigate to project
cd V1

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Services will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432
- **Qdrant**: localhost:6333
- **Redis**: localhost:6379

### Local Development

**Backend:**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
flask db upgrade

# Start server
flask run
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Project Structure

```
V1/
├── backend/                 # Flask API
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── agents/         # Google ADK agents
│   └── requirements.txt
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── api/            # API client
│   │   └── store/          # Zustand stores
│   └── package.json
└── docker-compose.yml      # Container orchestration
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, TipTap
- **Backend**: Python, Flask, SQLAlchemy
- **Database**: PostgreSQL, Qdrant (vector search)
- **AI**: Google Gemini via Agent Development Kit
- **Infrastructure**: Docker, Redis (Celery)

## Features

- 📄 Document Upload (PDF, DOCX, XLSX)
- ❓ Automatic Question Extraction
- 🤖 AI-Powered Answer Generation
- 📊 Confidence Scoring & Citations
- ✅ Review & Approval Workflow
- 📤 Export (PDF, DOCX, XLSX)
- 📚 Knowledge Base Management

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
GOOGLE_API_KEY=your-google-api-key

# Optional (defaults work for Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autorespond
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

## License

MIT
