# PostgreSQL Database Setup - Complete

## Database Created
- **Database Name**: `autorespond`
- **Host**: localhost
- **Port**: 5432
- **Username**: postgres
- **Password**: postgres

## Tables Created (18 Total)

### Core Application Tables
1. **users** - User accounts and authentication
2. **organizations** - Organization/company management
3. **projects** - RFP/RFI projects
4. **documents** - Uploaded RFP documents
5. **questions** - Extracted questions from documents
6. **answers** - Answers to questions
7. **answer_comments** - Comments on answers

### Knowledge Management Tables
8. **knowledge_folders** - Organize knowledge items
9. **knowledge_items** - Knowledge base items
10. **knowledge_profiles** - Knowledge profiles
11. **project_knowledge_profiles** - Link projects to knowledge profiles

### RFP & Proposal Tables
12. **rfp_sections** - Sections in RFP response
13. **rfp_section_types** - Types of RFP sections
14. **section_templates** - Templates for sections

### Administrative Tables
15. **audit_logs** - Audit trail for system actions
16. **export_history** - History of exports
17. **project_reviewers** - Track project reviewers
18. **compliance_mappings** - Compliance requirement mappings

## How to Connect

### Using psql CLI:
```bash
PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond
```

### Using Python:
The application will automatically connect using the DATABASE_URL from .env:
```
postgresql://postgres:postgres@localhost:5432/autorespond
```

## Verification
To verify tables are created, run:
```bash
PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "\dt"
```

## Next Steps
1. Start the backend server: `python3 run.py`
2. The application will use these tables automatically
3. If you need to add more tables or modify schema, use Flask-Migrate

## Reset Database (if needed)
To drop all tables and recreate them:
```bash
PGPASSWORD=postgres psql -U postgres -h localhost -d autorespond -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cd backend && python3 -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all()"
```
