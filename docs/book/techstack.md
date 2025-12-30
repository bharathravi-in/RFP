# Technology Stack

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type Safety |
| TailwindCSS | 3.x | Styling |
| Vite | 5.x | Build Tool |
| React Router | 6.x | Routing |
| Mermaid.js | 10.x | Diagram Rendering |
| React Hot Toast | 2.x | Notifications |

## Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11 | Language |
| Flask | 3.x | REST API |
| SQLAlchemy | 2.x | ORM |
| Celery | 5.x | Task Queue |
| Gunicorn | 21.x | WSGI Server |

## AI & ML

| Technology | Version | Purpose |
|------------|---------|---------|
| Google Gemini | 2.0 | LLM |
| Vertex AI ADK | Latest | AI Development Kit |
| Text Embeddings | Latest | Vector Generation |

## Databases

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15.x | Relational Data |
| Qdrant | 1.x | Vector Database |
| Redis | 7.x | Cache & Queues |

## Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker | 24.x | Containerization |
| Docker Compose | 2.x | Orchestration |

## Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | JavaScript Linting |
| Black | Python Formatting |
| Vitest | Frontend Testing |
| pytest | Backend Testing |
## Technical Highlights

### 1. Multi-Stage AI Orchestration
We use a custom agentic framework to orchestrate **Google Gemini 2.0** models. This allows for complex workflows like multi-document analysis, cross-referencing past proposals, and automated compliance checking.

### 2. Scalable Asynchronous Processing
Heavy lifting like document parsing, embedding generation, and large-scale content drafting is handled by **Celery** workers. 
- **Redis** serves as the message broker and result backend.
- **SQLAlchemy** ensures reliable persistence of metadata and project state.

### 3. Vector-Based Semantic Search
Our RAG pipeline leverages **Qdrant** for high-performance vector similarity search. This ensures that the AI always has the most relevant context, regardless of project size.

### 4. Real-time Collaborative UI
The frontend is built with **React** and **TailwindCSS**, featuring a responsive, dashboard-driven design that provides real-time feedback on AI processing and compliance status.
