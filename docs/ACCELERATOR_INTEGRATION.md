# Accelerator Integration for RFP Generation

## Overview
This document describes how vendor accelerators (POCs and ready-to-use solutions) are integrated into the AI-powered RFP answer generation system.

## What Are Accelerators?
Accelerators are pre-built solutions, POCs (Proof of Concepts), or reusable components that can significantly reduce project delivery time. They represent tangible assets that differentiate your company's RFP responses.

### Accelerator Fields
- **capability_name**: Name of the accelerator/POC
- **description**: Detailed description of what it does
- **technologies_used**: Array of technologies (e.g., ["Python", "React", "PostgreSQL"])
- **use_cases**: Detailed use cases where this accelerator applies
- **time_saved**: Quantified time savings (e.g., "2-3 weeks", "40% reduction")
- **demo_link**: URL to live demo or documentation

## How It Works

### 1. Technology Keyword Extraction
When generating an RFP answer, the system:
- Analyzes the RFP question text
- Extracts technology keywords (Python, AWS, React, etc.)
- Identifies use case keywords (automation, analytics, migration, etc.)
- Adds category-specific keywords

**Example:**
```
Question: "Describe your experience with Python-based microservices on AWS"
Extracted Keywords: ["python", "microservices", "aws", "api", "cloud"]
```

### 2. Accelerator Matching
The `VendorProfileAgent.get_relevant_capabilities()` method:
- Retrieves all accelerators for your organization
- Scores each accelerator based on:
  - **Technology matches** (weight: 3) - Matches against `technologies_used`
  - **Use case matches** (weight: 2) - Matches against `use_cases` field
  - **Name matches** (weight: 2) - Matches against `capability_name`
  - **Description matches** (weight: 1) - Matches against `description`
  - **Bonus** (+0.5) - Has quantified time savings
  - **Bonus** (+0.5) - Has demo link available
- Returns top 10 most relevant accelerators

**Example Scoring:**
```
Accelerator: "Python Microservices Boilerplate"
- technologies_used: ["Python", "FastAPI", "Docker", "PostgreSQL"]
- Matches "python": +3 points
- Matches "microservices": +2 points (use case)
- Has time_saved: +0.5 points
- Total Score: 5.5
```

### 3. Context Injection
The accelerators are formatted into the LLM prompt:
```
=== ACCELERATORS & POCs ===
Our ready-to-use solutions and POCs that can accelerate project delivery:

✓ Python Microservices Boilerplate
  Description: Production-ready FastAPI boilerplate with Docker orchestration
  Technologies: Python, FastAPI, Docker, PostgreSQL
  Use Cases: API development, microservices architecture, cloud-native apps
  ⚡ TIME SAVINGS: 2-3 weeks of setup and configuration
  🔗 Demo Available: https://demo.example.com/microservices
```

### 4. LLM Instructions
The system instructs the AI to:
- **Prominently highlight** matching accelerators in responses
- **Emphasize time savings** and quantifiable benefits
- **Mention demo availability** to build credibility
- **Quantify benefits** when accelerators are available

## Implementation Files

### Backend
1. **`vendor_profile_agent.py`**
   - `get_relevant_capabilities()`: Scoring and matching logic
   - `format_vendor_context_for_llm()`: Formats accelerators for prompt

2. **`answer_generator_agent.py`**
   - `_extract_tech_keywords()`: Extracts keywords from RFP questions
   - Enhanced prompt with accelerator-specific instructions

3. **`vendor_capability.py`** (Model)
   - Updated schema with accelerator fields
   - Removed old capability fields (expertise_level, years_of_experience, etc.)

4. **Migration**: `update_vendor_capabilities_to_accelerators.py`
   - Database migration to new schema
   - Migrates existing data (technologies → technologies_used)

### Frontend
1. **`CapabilityModal.tsx`**
   - Form for adding/editing accelerators
   - Technology tag management
   - Demo link validation

2. **`VendorProfileManager.tsx`**
   - Renamed "Capabilities" tab to "Accelerators"
   - Bulk upload integration

3. **`BulkUploadModal.tsx`**
   - CSV/Excel template for bulk accelerator upload
   - 6 columns: capability_name, description, technologies_used, use_cases, time_saved, demo_link

## Usage Examples

### Example 1: RFP Question with Technology Match
**Question**: "How do you handle real-time data processing with Python?"

**Accelerator Match**:
- Name: "Python Real-Time Analytics Pipeline"
- Technologies: ["Python", "Kafka", "Redis", "Apache Spark"]
- Time Saved: "40% reduction in development time"

**Generated Answer** (excerpt):
> "We have extensive experience with Python-based real-time data processing. In fact, we've developed a **Python Real-Time Analytics Pipeline accelerator** that leverages Kafka for event streaming and Apache Spark for processing. This ready-to-use solution has consistently delivered **40% reduction in development time** for our clients..."

### Example 2: RFP Question with Use Case Match
**Question**: "Describe your approach to migrating legacy systems to the cloud"

**Accelerator Match**:
- Name: "Cloud Migration Automation Framework"
- Use Cases: "Legacy system migration, database migration, AWS/Azure migration"
- Time Saved: "3-4 weeks per migration"

**Generated Answer** (excerpt):
> "Our cloud migration approach is systematic and proven. We've developed a **Cloud Migration Automation Framework** specifically designed for legacy system transitions. This accelerator has helped clients achieve **3-4 weeks faster migration** compared to manual processes..."

## Running the Migration

To apply the accelerator schema changes:

```bash
cd backend
flask db upgrade
```

To rollback (if needed):

```bash
flask db downgrade
```

## Testing the Integration

1. **Add Test Accelerators**:
   - Go to Vendor Profile → Accelerators tab
   - Add accelerators with diverse technologies
   - Include time_saved and demo_link values

2. **Generate RFP Answers**:
   - Create/open an RFP
   - Ask technical questions mentioning specific technologies
   - Verify accelerators appear in generated answers

3. **Check Scoring**:
   - Questions with exact technology matches should surface relevant accelerators
   - Generic questions should show top accelerators by score
   - Accelerators with time savings should be prioritized

## Best Practices

### For Adding Accelerators
1. **Be Specific**: Use precise technology names (e.g., "React 18" not "frontend")
2. **Quantify Time Savings**: Use concrete numbers ("2 weeks", "30%")
3. **Provide Demos**: Links to live demos increase credibility
4. **Write Clear Use Cases**: Help the matching algorithm understand applicability
5. **Keep Updated**: Remove outdated accelerators regularly

### For RFP Questions
The system works best when:
- Questions mention specific technologies or frameworks
- Questions describe concrete use cases
- Questions are in technical categories (not generic business questions)

## Monitoring & Optimization

### Check Accelerator Usage
To see which accelerators are being matched most often, monitor:
- RFP answer generation logs
- Technologies extracted from questions
- Accelerator scores in vendor context

### Improve Matching
If accelerators aren't surfacing:
1. Add more technology keywords to `_extract_tech_keywords()`
2. Enhance use_cases descriptions with common terms
3. Add synonyms to technology names (e.g., "nodejs" and "node.js")

## Future Enhancements

Potential improvements:
1. **Semantic Matching**: Use embeddings for fuzzy technology matching
2. **Usage Analytics**: Track which accelerators appear in winning proposals
3. **Auto-Tagging**: AI-powered technology extraction from accelerator descriptions
4. **Success Metrics**: Link accelerators to actual project outcomes
5. **Version Control**: Track accelerator versions and updates

## Support

For issues or questions:
- Check logs: `backend/logs/app.log`
- Verify migration: `flask db current`
- Test endpoint: `POST /api/vendor-profile/bulk-upload/capabilities`
