-- Fix missing columns in project_strategies table
-- Run this inside the database container:
-- sudo docker compose exec db psql -U postgres -d autorespond -f /path/to/this/file.sql

-- Add case_studies columns
ALTER TABLE project_strategies ADD COLUMN IF NOT EXISTS case_studies JSONB;
ALTER TABLE project_strategies ADD COLUMN IF NOT EXISTS case_studies_generated_at TIMESTAMP;

-- Add sprint_timeline columns  
ALTER TABLE project_strategies ADD COLUMN IF NOT EXISTS sprint_timeline JSONB;
ALTER TABLE project_strategies ADD COLUMN IF NOT EXISTS sprint_timeline_generated_at TIMESTAMP;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_strategies'
ORDER BY ordinal_position;
