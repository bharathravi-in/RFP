# Database Schema

## Core Tables

### projects
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | VARCHAR | Project name |
| description | TEXT | Description |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### documents
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| project_id | INTEGER | FK to projects |
| filename | VARCHAR | Original filename |
| file_path | VARCHAR | Storage path |
| file_type | VARCHAR | PDF, DOCX, etc |
| page_count | INTEGER | Number of pages |
| processed | BOOLEAN | Processing status |

### sections
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| project_id | INTEGER | FK to projects |
| section_type_id | INTEGER | FK to section_types |
| title | VARCHAR | Section title |
| content | TEXT | Section content |
| status | VARCHAR | draft/generated/approved |
| order_index | INTEGER | Display order |

### section_types
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | VARCHAR | Type name |
| slug | VARCHAR | URL-safe identifier |
| template_type | VARCHAR | narrative/table/technical |
| description | TEXT | Type description |

### questions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| project_id | INTEGER | FK to projects |
| question_text | TEXT | Question content |
| answer | TEXT | Generated answer |
| category | VARCHAR | Question category |
| status | VARCHAR | answered/pending |

## Vector Collections (Qdrant)

### documents
Stores document chunk embeddings for RAG retrieval.

### proposals
Stores past proposal content for knowledge reuse.
