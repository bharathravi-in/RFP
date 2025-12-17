# Phase 2: Feedback Loop Implementation Plan

## Goal
Implement a feedback loop system to capture user edits to AI-generated answers, track quality ratings, and enable continuous improvement of agent prompts and models.

## Components

### 1. Database Schema

**New Tables**:

```sql
-- Track user edits to AI-generated answers
CREATE TABLE answer_edits (
    id SERIAL PRIMARY KEY,
    answer_id INTEGER REFERENCES answers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    original_content TEXT NOT NULL,
    edited_content TEXT NOT NULL,
    edit_type VARCHAR(50), -- 'minor_fix', 'major_rewrite', 'tone_adjustment', 'factual_correction'
    confidence_before FLOAT,
    confidence_after FLOAT, -- Manually set by user if desired
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track quality feedback on answers
CREATE TABLE answer_feedback (
    id SERIAL PRIMARY KEY,
    answer_id INTEGER REFERENCES answers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
    feedback_type VARCHAR(50), -- 'helpful', 'needs_work', 'incorrect', 'excellent'
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track agent performance metrics
CREATE TABLE agent_performance (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    agent_name VARCHAR(100), -- 'DocumentAnalyzer', 'QuestionExtractor', etc.
    step_name VARCHAR(100), -- The workflow step
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    metadata JSONB, -- Additional context (question count, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Aggregate feedback for prompt improvement
CREATE TABLE prompt_feedback_summary (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100),
    category VARCHAR(100), -- 'security', 'technical', etc.
    avg_rating FLOAT,
    total_answers INTEGER,
    total_edits INTEGER,
    avg_edit_distance INTEGER, -- Levenshtein distance
    common_issues JSONB, -- Most frequent edit patterns
    last_updated TIMESTAMP DEFAULT NOW()
);
```

### 2. Database Models

**Files to Create/Modify**:
- `models/answer_edit.py` - AnswerEdit model
- `models/answer_feedback.py` - AnswerFeedback model  
- `models/agent_performance.py` - AgentPerformance model

### 3. Feedback Service

**File**: `services/feedback_service.py`

**Methods**:
- `track_answer_edit(answer_id, original, edited, user_id)` - Record edit
- `submit_answer_feedback(answer_id, rating, comment, user_id)` - Record rating
- `track_agent_performance(agent_name, step, duration, success)` - Log performance
- `get_edit_analytics(agent_name, category)` - Analyze edit patterns
- `get_improvement_recommendations()` - Suggest prompt improvements

### 4. API Endpoints

**File**: `routes/feedback.py`

**Endpoints**:
- `POST /api/feedback/answer-edit` - Submit answer edit
- `POST /api/feedback/answer-rating` - Submit quality rating
- `GET /api/feedback/analytics` - Get feedback analytics
- `GET /api/feedback/agent-performance` - Agent performance metrics
- `GET /api/feedback/improvement-suggestions` - Get improvement recommendations

### 5. Analytics & Insights

**Features**:
- Edit distance calculation (how much users change AI answers)
- Common edit patterns (tone changes, factual corrections)
- Category-specific performance (which categories need improvement)
- Confidence score correlation (do low-confidence answers get more edits?)

---

## Implementation Steps

1. Create database migration for new tables
2. Implement SQLAlchemy models
3. Build FeedbackService with tracking methods
4. Create API routes for feedback submission
5. Add analytics aggregation queries
6. Integrate performance tracking into agents
7. Build improvement recommendation engine

---

## Expected Outcomes

- Track 100% of user edits to AI answers
- Capture quality ratings on answers
- Identify which question categories need better prompts
- Measure agent performance over time
- Generate actionable improvement recommendations
