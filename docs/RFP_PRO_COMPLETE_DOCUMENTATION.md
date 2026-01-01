# RFP Pro - Complete Application Documentation

## Table of Contents
1. [Application Overview](#1-application-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Frontend Pages & Features](#3-frontend-pages--features)
4. [Backend Services](#4-backend-services)
5. [AI Agents (29 Agents)](#5-ai-agents-29-agents)
6. [Database Models](#6-database-models)
7. [API Endpoints](#7-api-endpoints)
8. [Frontend-Backend Integration Map](#8-frontend-backend-integration-map)
9. [Feature Summary](#9-feature-summary)

---

## 1. Application Overview

### What is RFP Pro?

RFP Pro is an **AI-powered Request for Proposal (RFP) response automation platform** that helps organizations:

1. **Upload RFP Documents** - Import RFP/RFI documents in various formats (PDF, DOCX, XLSX, PPTX)
2. **Extract Questions** - AI automatically identifies and extracts questions from RFP documents
3. **Build Knowledge Base** - Store organizational knowledge, past answers, and company information
4. **Generate AI Answers** - Use RAG (Retrieval Augmented Generation) to generate accurate, contextual answers
5. **Create Proposals** - Build complete proposal documents with multiple sections
6. **Export** - Generate final proposals in DOCX, XLSX, PDF, or PowerPoint formats

### Key Characteristics

| Characteristic | Description |
|---------------|-------------|
| **AI Provider Agnostic** | Supports LiteLLM, OpenAI, Google Gemini, Azure OpenAI |
| **Cloud Agnostic** | Supports local storage, Google Cloud Storage (GCS) |
| **Multi-tenant** | Organizations have isolated data and settings |
| **29 AI Agents** | Specialized agents for different tasks |
| **Real-time Collaboration** | WebSocket support for team collaboration |

---

## 2. Architecture Overview

### Technology Stack

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **Internationalization**: i18next

#### Backend
- **Framework**: Flask (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Task Queue**: Celery with Redis
- **Vector Database**: Qdrant (for semantic search)
- **Real-time**: Flask-SocketIO

#### AI/ML
- **LLM Integration**: LiteLLM (multi-provider abstraction)
- **Embeddings**: Google Gemini, OpenAI, custom providers
- **Vector Search**: Qdrant with hybrid dense+sparse search

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard │ │ Projects │ │Knowledge │ │ Proposal │ │ Settings │  │
│  │          │ │          │ │   Base   │ │ Builder  │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ REST API / WebSocket
┌───────────────────────────────▼─────────────────────────────────────┐
│                          BACKEND (Flask)                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   Routes (API)   │  │    Services      │  │   AI Agents      │   │
│  │  - auth          │  │  - ai_service    │  │  - orchestrator  │   │
│  │  - projects      │  │  - qdrant        │  │  - analyzer      │   │
│  │  - documents     │  │  - document      │  │  - generator     │   │
│  │  - knowledge     │  │  - knowledge     │  │  - validator     │   │
│  │  - agents        │  │  - export        │  │  - ... (29)      │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└──────────┬────────────────────┬────────────────────┬────────────────┘
           │                    │                    │
    ┌──────▼──────┐     ┌───────▼───────┐    ┌──────▼──────┐
    │ PostgreSQL  │     │    Qdrant     │    │   Redis     │
    │  (Data)     │     │  (Vectors)    │    │  (Cache)    │
    └─────────────┘     └───────────────┘    └─────────────┘
```

---

## 3. Frontend Pages & Features

### 3.1 Dashboard (`/dashboard`)
**File**: `frontend/src/pages/Dashboard.tsx`

**Purpose**: Main landing page after login showing overview of all activities.

**Features**:
- Welcome message with user's name
- Quick stats cards (Active Projects, Pending Reviews, Completed, Knowledge Items)
- Quick action buttons for common tasks
- Vendor eligibility panel
- Upcoming deadline widget
- Win rate chart and analytics
- Platform tour for new users

**Connected Services**:
- `projectsApi.list()` - Fetch all projects
- `questionsApi.list()` - Fetch questions for projects
- `knowledgeApi.list()` - Fetch knowledge base items

---

### 3.2 Projects List (`/projects`)
**File**: `frontend/src/pages/Projects.tsx`

**Purpose**: Display all projects with filtering, search, and management.

**Features**:
- Grid and Kanban view modes
- Search by project name
- Filter by status (Draft, In Progress, Review, Completed)
- Create new project modal
- Project outcome tracking (Won/Lost/Pending/Abandoned)
- Quick actions menu per project

**Connected Services**:
- `projectsApi.list()` - List all projects
- `projectsApi.create()` - Create new project
- `projectsApi.update()` - Update project
- `projectsApi.delete()` - Delete project
- `projectsApi.updateOutcome()` - Track project outcome

---

### 3.3 Project Detail (`/projects/:id`)
**File**: `frontend/src/pages/ProjectDetail.tsx`

**Purpose**: Main project workspace showing documents, questions, and workflow.

**Features**:
- Document upload with drag-and-drop
- Document list with actions (view, analyze, delete)
- Extracted questions list
- Proposal sections overview
- Go/No-Go analysis wizard
- Proposal health dashboard
- Workflow stepper showing progress
- Bulk document operations

**Connected Services**:
- `projectsApi.get()` - Get project details
- `documentsApi.upload()` - Upload RFP document
- `documentsApi.analyze()` - Trigger AI analysis
- `questionsApi.list()` - Get extracted questions
- `sectionsApi.listSections()` - Get proposal sections
- `agentsApi.analyzeRfpAsync()` - Full 11-agent pipeline

**AI Processing Flow**:
```
Document Upload → Parse → Document Analysis → Question Extraction 
    → Knowledge Retrieval → Answer Generation → Answer Validation 
    → Compliance Check → Clarification Analysis → Quality Review 
    → Executive Editing → Similarity Validation → Quality Gate
```

---

### 3.4 Answer Workspace (`/projects/:id/workspace`)
**File**: `frontend/src/pages/AnswerWorkspace.tsx`

**Purpose**: Focused workspace for reviewing and editing question answers.

**Features**:
- Question list with filtering by category
- AI answer generation with confidence scores
- Rich text editor for answer editing
- Similar answer suggestions panel
- Answer flags and review status
- Bulk answer generation
- Diagram rendering for technical answers
- Truth score badges
- Owner assignment suggestions

**Connected Services**:
- `questionsApi.list()` - Get all questions
- `answersApi.generate()` - Generate AI answer
- `answersApi.regenerate()` - Regenerate with feedback
- `answersApi.review()` - Approve/reject answer
- `exportApi.*` - Export answers

---

### 3.5 Proposal Builder (`/projects/:id/proposal`)
**File**: `frontend/src/pages/ProposalBuilder.tsx`

**Purpose**: Build complete proposal with multiple sections.

**Features**:
- Section type selector (Executive Summary, Technical Approach, Pricing, etc.)
- Section reordering via drag-and-drop
- AI section generation with knowledge context
- Section editor with markdown support
- Compliance matrix view
- Diagram generator for architectural diagrams
- Strategy tools panel (Win Themes, Competitive Analysis)
- Batch regeneration of sections
- Export to DOCX/PDF/PPTX

**Section Types Available**:
| Section | Description |
|---------|-------------|
| Executive Summary | High-level overview |
| Company Overview | Company background |
| Technical Approach | Technical solution |
| Pricing | Cost breakdown |
| Compliance | Regulatory requirements |
| Team | Team qualifications |
| Case Studies | Past project examples |
| Implementation | Implementation plan |
| Q&A Responses | Question answers |
| Clarifications | Clarification questions |
| Appendix | Supporting documents |

**Connected Services**:
- `sectionsApi.listSections()` - Get project sections
- `sectionsApi.addSection()` - Add new section
- `sectionsApi.generateSection()` - AI generation
- `sectionsApi.populateFromQA()` - Import Q&A
- `pptApi.generate()` - Generate PowerPoint

---

### 3.6 Knowledge Base (`/knowledge`)
**File**: `frontend/src/pages/KnowledgeBase.tsx`

**Purpose**: Manage organizational knowledge for RAG-based answer generation.

**Features**:
- Folder tree structure
- File upload (PDF, DOCX, XLSX, PPTX, TXT)
- Grid and list view modes
- Search across all knowledge items
- Preview modal for documents
- Reindex functionality for vector embeddings
- Chat with knowledge items
- Knowledge profile association

**Connected Services**:
- `knowledgeApi.list()` - List knowledge items
- `knowledgeApi.search()` - Semantic search
- `knowledgeApi.reindex()` - Rebuild embeddings
- `foldersApi.*` - Folder management

---

### 3.7 Answer Library (`/library`)
**File**: `frontend/src/pages/AnswerLibrary.tsx`

**Purpose**: Centralized library of approved answers for reuse.

**Features**:
- Search and filter answers
- Category and tag filtering
- Status management (Approved, Under Review, Draft, Archived)
- Answer editing inline
- Copy to clipboard
- Freshness indicators (Fresh, Stale, Expired)
- Approval workflow
- Usage tracking

**Connected Services**:
- `answerLibraryApi.list()` - List library items
- `answerLibraryApi.create()` - Add new answer
- `answerLibraryApi.approve()` - Approve answer
- `answerLibraryApi.archive()` - Archive answer
- `answerLibraryApi.search()` - Search answers

---

### 3.8 Co-Pilot Page (`/co-pilot`)
**File**: `frontend/src/pages/CoPilotPage.tsx`

**Purpose**: AI chat assistant for general help and agent interactions.

**Features**:
- Chat interface with AI
- Multiple chat sessions
- Agent mode for specialized tasks
- Web search capability
- Session history

**Connected Services**:
- `copilotApi.getSessions()` - Get chat sessions
- `copilotApi.createSession()` - Create new session
- `copilotApi.chat()` - Send message
- `copilotApi.getAgents()` - Get available agents

---

### 3.9 Document Chat (`/documents/:documentId/chat`)
**File**: `frontend/src/pages/DocumentChatPage.tsx`

**Purpose**: Chat with specific uploaded RFP documents.

**Features**:
- Full-screen chat experience
- Document context awareness
- Question-answer about document content
- Source citations

**Connected Services**:
- `documentChatApi.*` - Document-specific chat

---

### 3.10 Knowledge Chat (`/knowledge/:itemId/chat`)
**File**: `frontend/src/pages/KnowledgeChatPage.tsx`

**Purpose**: Chat with specific knowledge base items.

**Features**:
- Query knowledge base semantically
- Get contextual answers
- Source references

---

### 3.11 Proposal Chat (`/projects/:id/proposal-chat`)
**File**: `frontend/src/pages/ProposalChatPage.tsx`

**Purpose**: Chat about proposal in context of project.

**Features**:
- Full proposal context
- Section-specific queries
- Improvement suggestions

---

### 3.12 Analytics Deep Dive (`/analytics`)
**File**: `frontend/src/pages/AnalyticsDeepDive.tsx`

**Purpose**: Advanced analytics and insights.

**Features**:
- Win rate trend charts
- Content performance metrics
- Win/Loss analysis by dimensions
- Date range filtering
- Export to CSV

**Connected Services**:
- `analyticsApi.getContentPerformance()`
- `analyticsApi.getWinLossDeepDive()`
- `analyticsApi.getWinRateTrend()`

---

### 3.13 Settings (`/settings`)
**File**: `frontend/src/pages/Settings.tsx`

**Purpose**: User and organization configuration.

**Tabs**:
| Tab | Description |
|-----|-------------|
| Profile | User name, email, expertise tags, photo |
| Organization | Org settings, team members, invitations |
| Vendor Profile | Company registration, certifications |
| Knowledge Profiles | Configure knowledge dimension profiles |
| Filter Dimensions | Set up filtering dimensions |
| Security | Password change |
| Notifications | Notification preferences |
| AI Settings | LLM provider configuration (admin) |
| Branding | Organization branding (admin) |
| Help & Support | Platform tour, documentation |

**Connected Services**:
- `usersApi.updateProfile()` - Update user
- `organizationsApi.*` - Organization management
- `invitationsApi.*` - Team invitations

---

### 3.14 Templates Manager (`/templates`)
**File**: `frontend/src/pages/TemplatesManager.tsx`

**Purpose**: Manage export templates for DOCX and PPTX.

**Features**:
- Upload custom templates
- Set default templates
- Preview templates
- Delete templates

**Connected Services**:
- `exportTemplatesApi.list()`
- `exportTemplatesApi.upload()`
- `exportTemplatesApi.setDefault()`

---

### 3.15 Usage Dashboard (`/usage`)
**File**: `frontend/src/pages/UsageDashboard.tsx`

**Purpose**: Monitor AI usage and costs.

**Features**:
- Token usage tracking
- Cost breakdown
- Usage trends

---

### 3.16 Agent Performance Dashboard (`/superadmin/agent-performance`)
**File**: `frontend/src/pages/AgentPerformanceDashboard.tsx`

**Purpose**: Monitor AI agent performance metrics.

**Features**:
- Agent latency metrics
- Success/failure rates
- A/B experiment results

---

### 3.17 Super Admin Pages (`/superadmin/*`)
**Files**: `frontend/src/pages/superadmin/`

**Purpose**: Platform administration for super admins.

**Features**:
- Tenant management
- Feature flags
- System configuration

---

## 4. Backend Services

### 4.1 AI Service (`ai_service.py`)
**Purpose**: Core AI answer generation with RAG support.

**Key Features**:
- Confidence scoring based on context quality
- Category-specific prompting (security, compliance, technical, etc.)
- Similar answer suggestions
- Flag detection for low-confidence responses
- Multi-provider support via LLM abstraction

### 4.2 Qdrant Service (`qdrant_service.py`)
**Purpose**: Vector database operations for semantic search.

**Key Features**:
- Embedding storage and retrieval
- Semantic similarity search
- Organization-scoped collections
- Multi-provider embedding support

### 4.3 Document Service (`document_service.py`)
**Purpose**: Document parsing and text extraction.

**Supported Formats**:
- PDF (via pdfplumber)
- DOCX (via python-docx)
- XLSX (via openpyxl)
- PPTX (via python-pptx)

### 4.4 Knowledge Service (`knowledge_service.py`)
**Purpose**: Knowledge base operations and semantic search.

**Key Features**:
- Embedding creation
- Semantic search across knowledge base
- Organization-scoped knowledge

### 4.5 Export Service (`export_service.py`)
**Purpose**: Generate export documents.

**Export Formats**:
- DOCX - Word documents with template support
- XLSX - Excel spreadsheets
- PDF - PDF documents
- PPTX - PowerPoint presentations

### 4.6 Answer Reuse Service (`answer_reuse_service.py`)
**Purpose**: Find and suggest similar approved answers.

### 4.7 Hybrid Search Service (`hybrid_search_service.py`)
**Purpose**: Combine dense and sparse vector search for better results.

### 4.8 Chunking Service (`chunking_service.py`)
**Purpose**: Split large documents into searchable chunks.

### 4.9 Go/No-Go Service (`go_no_go_service.py`)
**Purpose**: Analyze RFP viability and recommend go/no-go decision.

### 4.10 Copilot Service (`copilot_service.py`)
**Purpose**: Power the AI chat assistant.

### 4.11 PPT Service (`ppt_service.py`)
**Purpose**: Generate PowerPoint presentations from proposal data.

### 4.12 Storage Service (`storage_service.py`)
**Purpose**: Abstract file storage (local/cloud).

**Providers**:
- Local filesystem
- Google Cloud Storage (GCS)

---

## 5. AI Agents (29 Agents)

### Agent Architecture

All agents follow a common pattern:
1. Receive input data (document text, questions, etc.)
2. Build prompts using templates
3. Call LLM provider via configuration
4. Parse and validate responses
5. Return structured results

### 5.1 Orchestrator Agent
**File**: `orchestrator_agent.py`

**Purpose**: Main coordinator that runs the complete RFP analysis workflow.

**Workflow Steps**:
1. Document Analysis → Extract structure and themes
2. Question Extraction → Identify questions
3. Knowledge Retrieval → Get relevant context
4. Answer Generation → Create draft answers
5. Answer Validation → Validate against knowledge
6. Compliance Check → Verify compliance claims
7. Clarification Analysis → Identify ambiguities
8. Quality Review → Review and score
9. Executive Editing → Polish language
10. Similarity Validation → Check consistency
11. Quality Gate → Final validation

### 5.2 Document Analyzer Agent
**File**: `document_analyzer_agent.py`

**Purpose**: Analyze RFP document structure, themes, and requirements.

**Outputs**:
- Document sections and structure
- Key themes and focus areas
- Requirements (mandatory/optional)
- Evaluation criteria
- Deliverables
- Timeline and deadlines
- Tables and attachments detected
- Document type classification
- Complexity score

### 5.3 Question Extractor Agent
**File**: `question_extractor_agent.py`

**Purpose**: Extract and classify questions from RFP documents.

**Features**:
- Identifies direct questions ("What is...?")
- Identifies imperative requirements ("Describe...", "Provide...")
- Classifies by category (security, compliance, technical, etc.)
- Assigns priority (critical, high, medium, low)
- Detects question type (direct, imperative, table, scoring)

### 5.4 Knowledge Base Agent
**File**: `knowledge_base_agent.py`

**Purpose**: Retrieve relevant knowledge for answering questions.

**Features**:
- Query expansion for better recall
- Hybrid search (dense + sparse vectors)
- Result re-ranking with LLM
- Similar answer retrieval
- Dimension-based filtering

### 5.5 Answer Generator Agent
**File**: `answer_generator_agent.py`

**Purpose**: Generate AI-powered answers using RAG approach.

**Features**:
- Category-specific instructions
- Format templates (paragraph, bullet, numbered, table, hybrid)
- Length control (short, medium, long, comprehensive)
- Source citation with [Source: X] format
- Confidence scoring

### 5.6 Answer Validator Agent
**File**: `answer_validator_agent.py`

**Purpose**: Cross-verify answers against knowledge base to prevent hallucinations.

**Features**:
- Claim extraction from answers
- Numeric claim validation (percentages, SLAs, timelines)
- Cross-answer consistency checking
- Claim severity classification (critical, high, medium, low)
- Suggested revisions for unverified claims

### 5.7 Compliance Checker Agent
**File**: `compliance_checker_agent.py`

**Purpose**: Validate compliance-related claims in answers.

**Supported Frameworks**:
- GDPR, HIPAA, SOC 2, ISO 27001
- PCI DSS, FedRAMP, CCPA, SOX
- Regional: PDPA (Singapore), LGPD (Brazil), PIPL (China)
- PIPEDA (Canada), APPI (Japan), DPDP (India)

**Features**:
- Detects compliance-sensitive questions
- Validates claims against certifications database
- Flags unverified compliance statements
- Suggests compliance-appropriate language

### 5.8 Clarification Agent
**File**: `clarification_agent.py`

**Purpose**: Identify ambiguous questions and generate clarification questions.

**Features**:
- Priority scoring based on question criticality
- Urgency calculation based on deadline proximity
- Grouped clarifications by category
- Follow-up tracking data
- Risk assessment for unclear questions

### 5.9 Quality Reviewer Agent
**File**: `quality_reviewer_agent.py`

**Purpose**: Review generated answers for accuracy and quality.

**Quality Dimensions**:
| Dimension | Weight | Description |
|-----------|--------|-------------|
| Accuracy | 25% | Factual correctness |
| Completeness | 20% | All parts addressed |
| Clarity | 20% | Readability |
| Relevance | 20% | Direct relevance to question |
| Tone | 15% | Professional language |

**Thresholds**:
- Auto-approve: > 85%
- Human review: < 70%
- Auto-reject: < 40%

### 5.10 Proposal Quality Gate Agent
**File**: `proposal_quality_gate_agent.py`

**Purpose**: Final validation layer before proposal export.

**Checks**:
- Completeness (all required sections present)
- Quality threshold enforcement
- Red-flag detection (unverified claims, binding commitments)
- Executive readiness assessment
- Word count minimums per section

### 5.11 Executive Editor Agent
**File**: `executive_editor_agent.py`

**Purpose**: Transform technical content into CXO-ready language.

**Features**:
- Tone elevation to executive level
- Jargon simplification
- Value proposition highlighting
- Storytelling enhancement
- Readability scoring

### 5.12 Similarity Validator Agent
**File**: `similarity_validator_agent.py`

**Purpose**: Compare generated content against approved Knowledge Base.

**Features**:
- Vector similarity scoring
- Deviation detection from established messaging
- Alignment suggestions
- Citation verification
- Consistency enforcement across sections

### 5.13 Section Mapper Agent
**File**: `section_mapper_agent.py`

**Purpose**: Map RFP questions to proposal sections.

**Features**:
- Default proposal structure mapping
- Organization naming convention learning
- Section completeness tracking
- Intelligent question grouping by theme

### 5.14 RFP Section Alignment Agent
**File**: `rfp_section_alignment_agent.py`

**Purpose**: Enterprise-grade section alignment for complete RFP documents.

**Features**:
- Knowledge Base-derived section taxonomy
- Intent-based question classification
- Complete section coverage enforcement
- Master section taxonomy with 15+ sections

### 5.15 Win Theme Agent
**File**: `win_theme_agent.py`

**Purpose**: Generate winning themes and differentiators.

**Outputs**:
- Win themes with proof points
- Differentiators vs competition
- Value propositions
- Ghost competitive messaging
- Key messages for different audiences

### 5.16 Competitive Analysis Agent
**File**: `competitive_analysis_agent.py`

**Purpose**: Analyze competitive landscape and positioning.

**Outputs**:
- Market context analysis
- Likely competitor types
- Positioning strategies
- Counter-objection responses
- Ghost competitive statements
- Evaluation impact recommendations

### 5.17 Pricing Calculator Agent
**File**: `pricing_calculator_agent.py`

**Purpose**: Calculate and generate pricing for proposals.

**Features**:
- Effort estimation from requirements
- Role-based pricing with rate cards
- Phase-wise cost breakdown
- Industry-specific pricing models
- Currency support

### 5.18 Legal Review Agent
**File**: `legal_review_agent.py`

**Purpose**: Review legal aspects of proposals.

**Checks**:
- Risky contractual language
- NDA and confidentiality compliance
- Liability and indemnification clauses
- Missing required legal elements
- Data protection compliance

### 5.19 Diagram Generator Agent
**File**: `diagram_generator_agent.py`

**Purpose**: Generate Mermaid.js diagrams from RFP documents.

**Diagram Types**:
- Architecture diagrams
- Business process flowcharts
- Sequence diagrams
- Timeline/Gantt charts
- Entity relationship diagrams
- Mind maps

### 5.20 PPT Generator Agent
**File**: `ppt_generator_agent.py`

**Purpose**: Generate PowerPoint presentation content.

**Slide Structure**:
1. Cover Slide
2. Agenda
3. Client Context & Challenges
4. Understanding of the Problem
5. Proposed Solution Overview
6. Solution Architecture
7. Scope of Work
8. Implementation Approach
9. Project Timeline
10. Team & Governance
11. Security & Compliance
12. Risks & Mitigation
13. Value Proposition
14. Case Studies
15. Pricing Summary
16. Assumptions & Dependencies
17. Why Choose Us
18. Next Steps
19. Thank You / Q&A

### 5.21 DOC Generator Agent
**File**: `doc_generator_agent.py`

**Purpose**: Generate DOCX document content.

**Features**:
- Multiple style presets (formal, consultative, technical, executive)
- Template configurations
- Section-by-section content generation

### 5.22 Feedback Learning Agent
**File**: `feedback_learning_agent.py`

**Purpose**: Learn from user edits to improve future responses.

**Learns**:
- Tone changes
- Content additions/removals
- Terminology preferences
- Structural changes
- Accuracy issues

### 5.23 Expert Routing Agent
**File**: `expert_routing_agent.py`

**Purpose**: Automatically suggest best owners for sections/questions.

**Features**:
- Match content to user expertise tags
- Confidence scoring for assignments
- Secondary owner suggestions
- Performance tracking integration

### 5.24 Content Freshness Agent
**File**: `content_freshness_agent.py`

**Purpose**: Monitor Answer Library for outdated information.

**Features**:
- Compare library answers with new documents
- Identify contradictions or outdated facts
- Suggest updates for stale content

### 5.25 RFP Section Alignment Fixer Agent
**File**: `rfp_section_alignment_fixer_agent.py`

**Purpose**: Fix misaligned questions in proposal sections.

### 5.26 Proposal Writer Agent
**File**: `proposal_writer_agent.py`

**Purpose**: Generate full proposal section content.

### 5.27-5.29 Utility Agents
- **Metrics Service** (`metrics_service.py`) - Agent performance tracking
- **Config** (`config.py`) - Agent configuration management
- **Utils** (`utils/`) - Shared utilities for retry, validation

---

## 6. Database Models

### 6.1 Core Models

#### Project
**Table**: `projects`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| name | String | Project name |
| description | Text | Project description |
| status | String | draft, in_progress, review, completed |
| completion_percent | Float | Progress percentage |
| due_date | DateTime | Deadline |
| client_type | String | government, private, ngo |
| geography | String | Region code |
| industry | String | Industry sector |
| go_no_go_status | String | pending, go, no_go |
| go_no_go_score | Float | Win probability 0-100 |
| outcome | String | pending, won, lost, abandoned |
| organization_id | Integer | FK to organizations |
| created_by | Integer | FK to users |

#### Document
**Table**: `documents`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| file_id | String | UUID for storage |
| filename | String | Stored filename |
| original_filename | String | Original upload name |
| file_type | String | pdf, docx, xlsx, pptx |
| status | String | pending, processing, completed, failed |
| embedding_status | String | Vector embedding status |
| extracted_text | Text | Parsed content |
| chunk_count | Integer | Number of vector chunks |
| project_id | Integer | FK to projects |

#### Question
**Table**: `questions`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| text | Text | Question text |
| section | String | Document section |
| category | String | security, compliance, technical, etc. |
| priority | String | high, normal, low |
| flags | JSON | Review flags |
| status | String | pending, answered, approved |
| project_id | Integer | FK to projects |
| document_id | Integer | FK to documents |
| assigned_to | Integer | FK to users |

#### Answer
**Table**: `answers`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| content | Text | Answer text |
| confidence_score | Float | AI confidence 0-1 |
| verification_score | Float | Truthfulness score |
| sources | JSON | Source citations |
| status | String | draft, pending_review, approved |
| version | Integer | Version number |
| is_ai_generated | Boolean | Generated by AI |
| question_id | Integer | FK to questions |
| reviewed_by | Integer | FK to users |

#### KnowledgeItem
**Table**: `knowledge_items`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| title | String | Item title |
| content | Text | Content text |
| tags | JSON | Tag array |
| category | String | security, compliance, product |
| source_type | String | document, manual, approved_answer |
| embedding_id | String | Qdrant point ID |
| geography | String | Regional scope |
| client_type | String | Client type scope |
| industry | String | Industry scope |
| organization_id | Integer | FK to organizations |
| folder_id | Integer | FK to folders |

#### RFPSection
**Table**: `rfp_sections`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| project_id | Integer | FK to projects |
| section_type_id | Integer | FK to section_types |
| title | String | Custom title |
| order | Integer | Display order |
| status | String | draft, generated, approved |
| content | Text | Section content |
| confidence_score | Float | AI confidence |
| sources | JSON | Knowledge sources used |
| assigned_to | Integer | FK to users |
| due_date | DateTime | Section deadline |

#### AnswerLibraryItem
**Table**: `answer_library`

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| question_text | Text | Library question |
| answer_text | Text | Library answer |
| category | String | Category |
| tags | JSON | Tags |
| status | String | draft, under_review, approved |
| usage_count | Integer | Times used |
| organization_id | Integer | FK to organizations |

### 6.2 Supporting Models

- **User** - User accounts and authentication
- **Organization** - Multi-tenant organizations
- **Invitation** - Team invitations
- **Notification** - User notifications
- **Comment** - Section/answer comments
- **ActivityLog** - Audit trail
- **ExportTemplate** - DOCX/PPTX templates
- **KnowledgeFolder** - Folder structure
- **KnowledgeProfile** - Dimension profiles
- **FilterDimension** - Filtering dimensions
- **ProposalVersion** - Version history
- **ComplianceItem** - Compliance tracking
- **Competitor** - Competitor database
- **Webhook** - External integrations
- **FeedbackLearning** - AI improvement data

---

## 7. API Endpoints

### Authentication (`/api/auth/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | User login |
| `/auth/register` | POST | User registration |
| `/auth/logout` | POST | User logout |
| `/auth/me` | GET | Get current user |
| `/auth/refresh` | POST | Refresh token |

### Projects (`/api/projects/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects` | GET | List projects |
| `/projects` | POST | Create project |
| `/projects/:id` | GET | Get project |
| `/projects/:id` | PUT | Update project |
| `/projects/:id` | DELETE | Delete project |
| `/projects/:id/outcome` | PUT | Update outcome |
| `/projects/:id/reviewers` | POST | Assign reviewers |
| `/projects/:id/go-no-go` | POST | Go/No-Go analysis |

### Documents (`/api/documents/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/documents/upload` | POST | Upload document |
| `/documents/:id` | GET | Get document |
| `/documents/:id/parse` | POST | Parse document |
| `/documents/:id/analyze` | POST | AI analysis |
| `/documents/:id/auto-build` | POST | Auto-build proposal |

### Questions (`/api/questions/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/questions` | GET | List questions |
| `/questions/:id` | PUT | Update question |
| `/questions/merge` | POST | Merge questions |
| `/questions/split` | POST | Split question |
| `/questions/:id/generate-answer` | POST | Generate answer |
| `/questions/auto-match` | POST | Auto-match answers |

### Answers (`/api/answers/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/answers/generate` | POST | Generate answer |
| `/answers/regenerate` | POST | Regenerate answer |
| `/answers/:id/review` | PUT | Review answer |

### Knowledge (`/api/knowledge/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/knowledge` | GET | List items |
| `/knowledge` | POST | Create item |
| `/knowledge/search` | POST | Semantic search |
| `/knowledge/reindex` | POST | Rebuild embeddings |

### Sections (`/api/sections/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects/:id/sections` | GET | List sections |
| `/projects/:id/sections` | POST | Add section |
| `/sections/:id/generate` | POST | Generate section |
| `/sections/:id/regenerate` | POST | Regenerate |
| `/projects/:id/sections/populate-from-qa` | POST | Import Q&A |

### Agents (`/api/agents/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agents/health` | GET | Agent health |
| `/agents/analyze-rfp` | POST | Full RFP analysis |
| `/agents/analyze-rfp-async` | POST | Async analysis |
| `/agents/job-status/:id` | GET | Job status |
| `/agents/generate-win-themes` | POST | Win themes |
| `/agents/competitive-analysis` | POST | Competitive analysis |
| `/agents/calculate-pricing` | POST | Pricing |
| `/agents/legal-review` | POST | Legal review |
| `/agents/generate-diagram` | POST | Generate diagram |

### Export (`/api/export/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/export/docx` | POST | Export to Word |
| `/export/xlsx` | POST | Export to Excel |
| `/export/pdf` | POST | Export to PDF |
| `/ppt/generate/:id` | POST | Generate PowerPoint |

### Analytics (`/api/analytics/*`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analytics/dashboard` | GET | Dashboard stats |
| `/analytics/win-rate-trend` | GET | Win rate over time |
| `/analytics/content-performance` | GET | Content metrics |
| `/analytics/win-loss-deep-dive` | GET | Deep dive analysis |

---

## 8. Frontend-Backend Integration Map

### Page → API → Service → Agent Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │     │   Backend API   │     │    Service      │     │    AI Agent     │
│     Page        │────▶│    Endpoint     │────▶│                 │────▶│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘

Dashboard ──────────────▶ /projects, /analytics ────▶ analyticsApi ──────▶ N/A

ProjectDetail ──────────▶ /documents/upload ────────▶ DocumentService ──▶ OrchestratorAgent
                        ▶ /agents/analyze-rfp-async                     ├─ DocumentAnalyzerAgent
                                                                        ├─ QuestionExtractorAgent
                                                                        ├─ KnowledgeBaseAgent
                                                                        ├─ AnswerGeneratorAgent
                                                                        ├─ AnswerValidatorAgent
                                                                        ├─ ComplianceCheckerAgent
                                                                        ├─ ClarificationAgent
                                                                        ├─ QualityReviewerAgent
                                                                        ├─ ExecutiveEditorAgent
                                                                        ├─ SimilarityValidatorAgent
                                                                        └─ ProposalQualityGateAgent

AnswerWorkspace ────────▶ /answers/generate ────────▶ AIService ────────▶ AnswerGeneratorAgent
                                                    ▶ QdrantService     ▶ KnowledgeBaseAgent

ProposalBuilder ────────▶ /sections/generate ───────▶ SectionService ──▶ SectionMapperAgent
                        ▶ /agents/generate-win-themes                   ▶ WinThemeAgent
                        ▶ /agents/competitive-analysis                  ▶ CompetitiveAnalysisAgent
                        ▶ /agents/calculate-pricing                     ▶ PricingCalculatorAgent
                        ▶ /agents/generate-diagram                      ▶ DiagramGeneratorAgent

KnowledgeBase ──────────▶ /knowledge ───────────────▶ KnowledgeService ▶ N/A
                        ▶ /knowledge/search         ▶ QdrantService    ▶ KnowledgeBaseAgent

AnswerLibrary ──────────▶ /answer-library ──────────▶ LibraryService ──▶ ContentFreshnessAgent
                        ▶ /agents/check-freshness                      ▶ FeedbackLearningAgent

CoPilot ────────────────▶ /copilot/chat ────────────▶ CopilotService ──▶ OrchestratorAgent

Export ─────────────────▶ /export/docx ─────────────▶ ExportService ───▶ DOCGeneratorAgent
                        ▶ /ppt/generate             ▶ PPTService       ▶ PPTGeneratorAgent
```

---

## 9. Feature Summary

### Core Features

| Feature | Description | Key Components |
|---------|-------------|----------------|
| **Document Upload & Parsing** | Upload RFP documents in multiple formats | DocumentService, Storage providers |
| **AI Question Extraction** | Automatically extract questions from RFPs | QuestionExtractorAgent |
| **Knowledge Base** | Store and search organizational knowledge | Qdrant, KnowledgeService |
| **RAG Answer Generation** | Generate answers using relevant context | AIService, KnowledgeBaseAgent, AnswerGeneratorAgent |
| **Answer Validation** | Verify accuracy and prevent hallucinations | AnswerValidatorAgent, ComplianceCheckerAgent |
| **Proposal Building** | Create complete proposals with sections | SectionMapperAgent, multiple generators |
| **Export** | Generate DOCX, PDF, PPTX outputs | ExportService, PPTService |

### Advanced Features

| Feature | Description | Key Components |
|---------|-------------|----------------|
| **Go/No-Go Analysis** | Assess RFP viability before responding | GoNoGoService |
| **Win Theme Generation** | Create winning themes and differentiators | WinThemeAgent |
| **Competitive Analysis** | Analyze competitive landscape | CompetitiveAnalysisAgent |
| **Pricing Calculation** | Generate pricing estimates | PricingCalculatorAgent |
| **Legal Review** | Check for legal risks | LegalReviewAgent |
| **Diagram Generation** | Create Mermaid.js diagrams | DiagramGeneratorAgent |
| **Answer Library** | Reusable approved answers | AnswerReuseService, ContentFreshnessAgent |
| **Feedback Learning** | Learn from user edits | FeedbackLearningAgent |
| **Expert Routing** | Auto-assign to experts | ExpertRoutingAgent |
| **Real-time Collaboration** | Multi-user editing | WebSocket, Flask-SocketIO |

### AI Provider Support

| Provider | Configuration |
|----------|---------------|
| **LiteLLM** | Base URL + API Key |
| **Google Gemini** | GOOGLE_API_KEY |
| **OpenAI** | OPENAI_API_KEY |
| **Azure OpenAI** | AZURE_OPENAI_API_KEY + Endpoint |

### Embedding Provider Support

| Provider | Configuration |
|----------|---------------|
| **Google** | models/embedding-001 |
| **OpenAI** | text-embedding-3-small |
| **Custom** | API endpoint |

---

## Appendix: File Structure

```
RFP/
├── frontend/
│   ├── src/
│   │   ├── pages/           # 17 page components
│   │   ├── components/      # 30+ component directories
│   │   ├── api/client.ts    # All API calls
│   │   ├── store/           # Zustand state stores
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript types
│   └── ...
├── backend/
│   ├── app/
│   │   ├── routes/          # 40+ route files
│   │   ├── services/        # 45+ service files
│   │   ├── agents/          # 29 AI agent files
│   │   ├── models/          # 30+ database models
│   │   └── ...
│   └── ...
├── config/
│   └── agents.yaml          # Agent configuration
└── docs/                    # Documentation
```

---

*Document generated: December 31, 2025*
*RFP Pro Version: AI-Powered RFP Response Automation Platform*
