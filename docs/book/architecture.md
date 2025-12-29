# System Architecture

RFP Pro is built on a modern, scalable microservices-inspired architecture designed to handle complex AI workloads and document processing.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend Layer (React)"]
        React["Web Application<br/>TypeScript + TailwindCSS"]
    end

    subgraph API["API Gateway Layer"]
        Flask["Flask REST API<br/>Authentication & Routing"]
    end

    subgraph AI["AI Orchestration Engine"]
        Orchestrator["Agent Orchestrator<br/>Gemini 2.0 Logic"]
        Gemini["Google Gemini 2.0<br/>Flash & Pro Models"]
    end

    subgraph Agents["Autonomous AI Agents"]
        DocAnalyzer["Document Analyzer"]
        KnowledgeBase["Knowledge Base"]
        ProposalWriter["Proposal Writer"]
        ComplianceChecker["Compliance Checker"]
        DiagramGen["Diagram Generator"]
    end

    subgraph Storage["Persistence Layer"]
        Postgres["PostgreSQL<br/>Relational Data"]
        Qdrant["Qdrant<br/>Vector Embeddings"]
        Redis["Redis<br/>Cache & Task Queue"]
    end

    React --> Flask
    Flask --> Orchestrator
    Orchestrator --> Gemini
    Orchestrator --> Agents
    Flask --> Storage
    Agents --> Storage
```

## Component Details

### Frontend Layer
- **Framework**: React 18 with TypeScript for type-safe development.
- **Styling**: TailwindCSS for a modern, responsive UI.
- **State Management**: Zustand for lightweight and efficient global state.
- **Rich Text Editing**: TipTap for a seamless proposal editing experience.
- **Visuals**: Mermaid.js for rendering AI-generated diagrams.

### API Layer
- **Framework**: Flask (Python 3.11) provides a robust RESTful API.
- **Security**: JWT-based authentication for secure session management.
- **Concurrency**: Celery with Redis backend for handling long-running AI tasks.
- **Processing**: Specialized services for PDF, DOCX, and XLSX parsing.

### AI Engine (Gemini 2.0)
The heart of RFP Pro is the **Google Gemini 2.0 Flash** model, coordinated by a custom Agent Orchestrator. 
- **Agent Development Kit (ADK)**: Used to define and manage 25+ specialized agents.
- **Dynamic Prompting**: Context-aware prompt engineering based on RAG results.
- **Function Calling**: Used for structured data extraction and tool usage.

### Storage & Search
- **PostgreSQL**: Stores structured data like users, projects, and compliance matrices.
- **Qdrant Vector DB**: High-performance semantic search for the RAG pipeline.
- **Redis**: Provides fast caching and serves as the message broker for Celery workers.

## Multi-Agent Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant F as API
    participant O as Orchestrator
    participant A as Agents
    participant G as Gemini 2.0
    participant S as Storage

    U->>F: Upload RFP
    F->>O: Initiate Analysis
    O->>A: DocAnalyzer Agent
    A->>G: Extract Requirements
    G-->>A: Structured JSON
    A->>S: Save Requirements
    O->>A: SectionMapper Agent
    A->>S: Map to Template
    Note over U,S: AI-Powered Analysis Complete
```
