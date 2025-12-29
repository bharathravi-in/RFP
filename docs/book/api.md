# API Reference

## Base URL
```
http://localhost:5002/api
```

## Authentication
All endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## Projects

### List Projects
```
GET /api/projects
```

### Create Project
```
POST /api/projects
Content-Type: application/json

{
  "name": "Project Name",
  "description": "Description"
}
```

### Get Project
```
GET /api/projects/{id}
```

### Delete Project
```
DELETE /api/projects/{id}
```

---

## Documents

### Upload Document
```
POST /api/documents
Content-Type: multipart/form-data

file: <binary>
project_id: 1
```

### List Documents
```
GET /api/documents?project_id=1
```

### Delete Document
```
DELETE /api/documents/{id}
```

---

## Sections

### Get Sections
```
GET /api/projects/{id}/sections
```

### Generate Content
```
POST /api/sections/{id}/generate
```

### Update Section
```
PUT /api/sections/{id}
Content-Type: application/json

{
  "content": "Updated content"
}
```

---

## AI

### Chat with Assistant
```
POST /api/chat
Content-Type: application/json

{
  "message": "Your message",
  "section_id": 1
}
```

### Generate Diagram
```
POST /api/diagrams/generate
Content-Type: application/json

{
  "project_id": 1,
  "diagram_type": "architecture"
}
```

### Check Compliance
```
GET /api/compliance?project_id=1
```

---

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```
