"""
OpenAPI/Swagger documentation configuration for RFP API.

Provides interactive API documentation at /api/docs
"""
from flask import Blueprint

# API metadata
API_TITLE = "RFP Pro API"
API_VERSION = "1.0.0"
API_DESCRIPTION = """
AI-Powered RFP Proposal Generation API

## Features
- **Authentication**: User login, registration, profile management
- **Projects**: Create and manage RFP projects
- **Documents**: Upload and analyze RFP documents
- **Questions & Answers**: Extract and answer questions from RFPs
- **Knowledge Base**: Store and retrieve knowledge items
- **AI Agents**: Multi-agent RFP analysis system
- **Analytics**: Track proposal metrics
- **Export**: Generate proposals in multiple formats

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-token>
```
"""

# OpenAPI spec
OPENAPI_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": API_TITLE,
        "version": API_VERSION,
        "description": API_DESCRIPTION,
    },
    "servers": [{"url": "/api", "description": "API Server"}],
    "components": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT"
            }
        },
        "schemas": {
            "Error": {
                "type": "object",
                "properties": {
                    "error": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "string"},
                            "message": {"type": "string"},
                            "request_id": {"type": "string"}
                        }
                    }
                }
            }
        }
    },
    "security": [{"bearerAuth": []}],
    "tags": [
        {"name": "Health", "description": "Health check endpoints"},
        {"name": "Authentication", "description": "User authentication & profile"},
        {"name": "Projects", "description": "RFP project management"},
        {"name": "Documents", "description": "Document upload & analysis"},
        {"name": "Questions", "description": "Question extraction & management"},
        {"name": "Answers", "description": "Answer generation & management"},
        {"name": "Knowledge", "description": "Knowledge base management"},
        {"name": "Folders", "description": "Knowledge folder organization"},
        {"name": "AI Agents", "description": "Multi-agent RFP analysis"},
        {"name": "Sections", "description": "Proposal sections management"},
        {"name": "Compliance", "description": "Compliance matrix"},
        {"name": "Analytics", "description": "Dashboard & metrics"},
        {"name": "Export", "description": "Export proposals"},
        {"name": "Notifications", "description": "User notifications"},
        {"name": "Comments", "description": "Inline comments & mentions"},
        {"name": "Search", "description": "Smart search"},
        {"name": "Users", "description": "User management"},
        {"name": "Organizations", "description": "Organization management"},
    ],
    "paths": {
        # Health
        "/health": {
            "get": {
                "tags": ["Health"],
                "summary": "Health check",
                "security": [],
                "responses": {"200": {"description": "Service healthy"}}
            }
        },
        "/ready": {
            "get": {
                "tags": ["Health"],
                "summary": "Readiness check with dependencies",
                "security": [],
                "responses": {"200": {"description": "Service ready"}}
            }
        },
        
        # Authentication
        "/auth/login": {
            "post": {
                "tags": ["Authentication"],
                "summary": "User login",
                "security": [],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["email", "password"],
                                "properties": {
                                    "email": {"type": "string", "format": "email"},
                                    "password": {"type": "string"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {"description": "Login successful"},
                    "401": {"description": "Invalid credentials"}
                }
            }
        },
        "/auth/me": {
            "get": {
                "tags": ["Authentication"],
                "summary": "Get current user profile",
                "responses": {"200": {"description": "User profile"}}
            }
        },
        "/auth/register": {
            "post": {
                "tags": ["Authentication"],
                "summary": "Register new user",
                "security": [],
                "responses": {"201": {"description": "User created"}}
            }
        },
        
        # Projects
        "/projects": {
            "get": {
                "tags": ["Projects"],
                "summary": "List all projects",
                "responses": {"200": {"description": "List of projects"}}
            },
            "post": {
                "tags": ["Projects"],
                "summary": "Create new project",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["name", "client_name"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "client_name": {"type": "string"},
                                    "description": {"type": "string"},
                                    "deadline": {"type": "string", "format": "date"}
                                }
                            }
                        }
                    }
                },
                "responses": {"201": {"description": "Project created"}}
            }
        },
        "/projects/{id}": {
            "get": {
                "tags": ["Projects"],
                "summary": "Get project by ID",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Project details"}}
            },
            "put": {
                "tags": ["Projects"],
                "summary": "Update project",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Project updated"}}
            },
            "delete": {
                "tags": ["Projects"],
                "summary": "Delete project",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"204": {"description": "Project deleted"}}
            }
        },
        
        # Documents
        "/documents": {
            "get": {
                "tags": ["Documents"],
                "summary": "List documents",
                "parameters": [{"name": "project_id", "in": "query", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "List of documents"}}
            },
            "post": {
                "tags": ["Documents"],
                "summary": "Upload document",
                "parameters": [{"name": "project_id", "in": "query", "required": True, "schema": {"type": "integer"}}],
                "requestBody": {
                    "required": True,
                    "content": {"multipart/form-data": {"schema": {"type": "object", "properties": {"file": {"type": "string", "format": "binary"}}}}}
                },
                "responses": {"201": {"description": "Document uploaded"}}
            }
        },
        "/documents/{id}": {
            "get": {
                "tags": ["Documents"],
                "summary": "Get document",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Document details"}}
            },
            "delete": {
                "tags": ["Documents"],
                "summary": "Delete document",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"204": {"description": "Document deleted"}}
            }
        },
        "/documents/{id}/analyze": {
            "post": {
                "tags": ["Documents"],
                "summary": "Analyze document with AI",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Analysis results"}}
            }
        },
        "/documents/{id}/chat": {
            "get": {
                "tags": ["Documents"],
                "summary": "Get document chat session",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Chat session"}}
            },
            "post": {
                "tags": ["Documents"],
                "summary": "Send message to document chat",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "AI response"}}
            }
        },
        
        # Questions
        "/questions": {
            "get": {
                "tags": ["Questions"],
                "summary": "List questions",
                "parameters": [{"name": "project_id", "in": "query", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "List of questions"}}
            }
        },
        "/questions/{id}": {
            "get": {
                "tags": ["Questions"],
                "summary": "Get question",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Question details"}}
            },
            "put": {
                "tags": ["Questions"],
                "summary": "Update question",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Question updated"}}
            }
        },
        
        # Answers
        "/answers": {
            "get": {
                "tags": ["Answers"],
                "summary": "List answers",
                "responses": {"200": {"description": "List of answers"}}
            }
        },
        "/answers/{id}": {
            "get": {
                "tags": ["Answers"],
                "summary": "Get answer",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Answer details"}}
            },
            "put": {
                "tags": ["Answers"],
                "summary": "Update answer",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Answer updated"}}
            }
        },
        
        # Knowledge Base
        "/knowledge": {
            "get": {
                "tags": ["Knowledge"],
                "summary": "List knowledge items",
                "responses": {"200": {"description": "List of knowledge items"}}
            }
        },
        "/knowledge/{id}": {
            "get": {
                "tags": ["Knowledge"],
                "summary": "Get knowledge item",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Knowledge item"}}
            },
            "delete": {
                "tags": ["Knowledge"],
                "summary": "Delete knowledge item",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"204": {"description": "Deleted"}}
            }
        },
        "/knowledge/search": {
            "get": {
                "tags": ["Knowledge"],
                "summary": "Search knowledge base",
                "parameters": [{"name": "q", "in": "query", "required": True, "schema": {"type": "string"}}],
                "responses": {"200": {"description": "Search results"}}
            }
        },
        "/knowledge/{id}/chat": {
            "get": {
                "tags": ["Knowledge"],
                "summary": "Get knowledge chat session",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Chat session"}}
            },
            "post": {
                "tags": ["Knowledge"],
                "summary": "Send message to knowledge chat",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "AI response"}}
            }
        },
        
        # Folders
        "/folders": {
            "get": {
                "tags": ["Folders"],
                "summary": "List knowledge folders",
                "responses": {"200": {"description": "List of folders"}}
            },
            "post": {
                "tags": ["Folders"],
                "summary": "Create folder",
                "responses": {"201": {"description": "Folder created"}}
            }
        },
        "/folders/{id}": {
            "get": {
                "tags": ["Folders"],
                "summary": "Get folder",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Folder details"}}
            },
            "put": {
                "tags": ["Folders"],
                "summary": "Update folder",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Folder updated"}}
            },
            "delete": {
                "tags": ["Folders"],
                "summary": "Delete folder",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"204": {"description": "Deleted"}}
            }
        },
        "/folders/{id}/items": {
            "post": {
                "tags": ["Folders"],
                "summary": "Upload file to folder",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"201": {"description": "Item added"}}
            }
        },
        
        # Sections
        "/sections": {
            "get": {
                "tags": ["Sections"],
                "summary": "List proposal sections",
                "parameters": [{"name": "project_id", "in": "query", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "List of sections"}}
            },
            "post": {
                "tags": ["Sections"],
                "summary": "Create section",
                "responses": {"201": {"description": "Section created"}}
            }
        },
        "/sections/{id}": {
            "get": {
                "tags": ["Sections"],
                "summary": "Get section",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Section details"}}
            },
            "put": {
                "tags": ["Sections"],
                "summary": "Update section",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Section updated"}}
            },
            "delete": {
                "tags": ["Sections"],
                "summary": "Delete section",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"204": {"description": "Deleted"}}
            }
        },
        "/sections/{id}/generate": {
            "post": {
                "tags": ["Sections"],
                "summary": "Generate section content with AI",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Generated content"}}
            }
        },
        
        # AI Agents
        "/agents/analyze": {
            "post": {
                "tags": ["AI Agents"],
                "summary": "Run multi-agent RFP analysis",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "project_id": {"type": "integer"},
                                    "document_id": {"type": "integer"}
                                }
                            }
                        }
                    }
                },
                "responses": {"200": {"description": "Analysis results"}}
            }
        },
        "/agents/status/{job_id}": {
            "get": {
                "tags": ["AI Agents"],
                "summary": "Get agent job status",
                "parameters": [{"name": "job_id", "in": "path", "required": True, "schema": {"type": "string"}}],
                "responses": {"200": {"description": "Job status"}}
            }
        },
        
        # AI Generation
        "/ai/generate-answer": {
            "post": {
                "tags": ["AI Agents"],
                "summary": "Generate answer for question",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {"question_id": {"type": "integer"}}
                            }
                        }
                    }
                },
                "responses": {"200": {"description": "Generated answer"}}
            }
        },
        "/ai/improve-answer": {
            "post": {
                "tags": ["AI Agents"],
                "summary": "Improve existing answer",
                "responses": {"200": {"description": "Improved answer"}}
            }
        },
        
        # Compliance
        "/compliance": {
            "get": {
                "tags": ["Compliance"],
                "summary": "Get compliance matrix",
                "parameters": [{"name": "project_id", "in": "query", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Compliance matrix"}}
            }
        },
        "/compliance/check": {
            "post": {
                "tags": ["Compliance"],
                "summary": "Run compliance check",
                "responses": {"200": {"description": "Compliance results"}}
            }
        },
        
        # Go/No-Go
        "/go-no-go/{project_id}": {
            "get": {
                "tags": ["Analytics"],
                "summary": "Get go/no-go analysis",
                "parameters": [{"name": "project_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Analysis results"}}
            },
            "post": {
                "tags": ["Analytics"],
                "summary": "Run go/no-go analysis",
                "parameters": [{"name": "project_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Analysis results"}}
            }
        },
        
        # Analytics
        "/analytics/dashboard": {
            "get": {
                "tags": ["Analytics"],
                "summary": "Get dashboard metrics",
                "responses": {"200": {"description": "Dashboard data"}}
            }
        },
        "/analytics/projects": {
            "get": {
                "tags": ["Analytics"],
                "summary": "Get project analytics",
                "responses": {"200": {"description": "Project metrics"}}
            }
        },
        
        # Export
        "/export/proposal/{project_id}": {
            "get": {
                "tags": ["Export"],
                "summary": "Export proposal",
                "parameters": [
                    {"name": "project_id", "in": "path", "required": True, "schema": {"type": "integer"}},
                    {"name": "format", "in": "query", "schema": {"type": "string", "enum": ["pdf", "docx", "html"]}}
                ],
                "responses": {"200": {"description": "Exported file"}}
            }
        },
        "/ppt/generate/{project_id}": {
            "post": {
                "tags": ["Export"],
                "summary": "Generate PowerPoint presentation",
                "parameters": [{"name": "project_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "PPT file"}}
            }
        },
        
        # Notifications
        "/notifications": {
            "get": {
                "tags": ["Notifications"],
                "summary": "Get user notifications",
                "parameters": [{"name": "limit", "in": "query", "schema": {"type": "integer", "default": 10}}],
                "responses": {"200": {"description": "Notifications"}}
            }
        },
        "/notifications/unread-count": {
            "get": {
                "tags": ["Notifications"],
                "summary": "Get unread notification count",
                "responses": {"200": {"description": "Count"}}
            }
        },
        "/notifications/{id}/read": {
            "post": {
                "tags": ["Notifications"],
                "summary": "Mark notification as read",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Marked read"}}
            }
        },
        
        # Comments
        "/comments": {
            "get": {
                "tags": ["Comments"],
                "summary": "Get comments",
                "responses": {"200": {"description": "Comments"}}
            },
            "post": {
                "tags": ["Comments"],
                "summary": "Add comment",
                "responses": {"201": {"description": "Comment added"}}
            }
        },
        
        # Search
        "/search": {
            "get": {
                "tags": ["Search"],
                "summary": "Smart search across all content",
                "parameters": [{"name": "q", "in": "query", "required": True, "schema": {"type": "string"}}],
                "responses": {"200": {"description": "Search results"}}
            }
        },
        
        # Users
        "/users/me": {
            "get": {
                "tags": ["Users"],
                "summary": "Get current user",
                "responses": {"200": {"description": "User profile"}}
            },
            "put": {
                "tags": ["Users"],
                "summary": "Update current user",
                "responses": {"200": {"description": "User updated"}}
            }
        },
        
        # Organizations
        "/organizations": {
            "get": {
                "tags": ["Organizations"],
                "summary": "Get current organization",
                "responses": {"200": {"description": "Organization"}}
            },
            "put": {
                "tags": ["Organizations"],
                "summary": "Update organization",
                "responses": {"200": {"description": "Updated"}}
            }
        },
        "/organizations/users": {
            "get": {
                "tags": ["Organizations"],
                "summary": "List organization users",
                "responses": {"200": {"description": "Users list"}}
            }
        },
        "/organizations/invite": {
            "post": {
                "tags": ["Organizations"],
                "summary": "Invite user to organization",
                "responses": {"200": {"description": "Invitation sent"}}
            }
        },
        
        # Answer Library
        "/answer-library": {
            "get": {
                "tags": ["Answers"],
                "summary": "List answer library items",
                "responses": {"200": {"description": "Library items"}}
            },
            "post": {
                "tags": ["Answers"],
                "summary": "Add to answer library",
                "responses": {"201": {"description": "Item added"}}
            }
        },
        
        # Preview
        "/preview/{id}": {
            "get": {
                "tags": ["Documents"],
                "summary": "Preview document",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Preview data"}}
            }
        },
        "/preview/{id}/signed-url": {
            "get": {
                "tags": ["Documents"],
                "summary": "Get signed URL for document",
                "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Signed URL"}}
            }
        },
        
        # Versions
        "/versions/section/{section_id}": {
            "get": {
                "tags": ["Sections"],
                "summary": "Get section version history",
                "parameters": [{"name": "section_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Version history"}}
            }
        },
        "/versions/{version_id}/restore": {
            "post": {
                "tags": ["Sections"],
                "summary": "Restore section version",
                "parameters": [{"name": "version_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "Restored"}}
            }
        },
        
        # Activity
        "/activity": {
            "get": {
                "tags": ["Analytics"],
                "summary": "Get activity timeline",
                "responses": {"200": {"description": "Activity log"}}
            }
        },
        
        # Co-Pilot
        "/copilot/chat": {
            "post": {
                "tags": ["AI Agents"],
                "summary": "Chat with AI co-pilot",
                "responses": {"200": {"description": "AI response"}}
            }
        },
        
        # Feedback
        "/feedback": {
            "post": {
                "tags": ["Analytics"],
                "summary": "Submit feedback",
                "responses": {"201": {"description": "Feedback submitted"}}
            }
        },
        
        # AI Config
        "/ai-config": {
            "get": {
                "tags": ["AI Agents"],
                "summary": "Get AI configuration",
                "responses": {"200": {"description": "Config"}}
            },
            "put": {
                "tags": ["AI Agents"],
                "summary": "Update AI configuration",
                "responses": {"200": {"description": "Updated"}}
            }
        },
    }
}


bp = Blueprint('api_docs', __name__)


@bp.route('/docs')
def swagger_ui():
    """Serve Swagger UI."""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>RFP Pro API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        body { margin: 0; padding: 0; }
        .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: "/api/openapi.json",
                dom_id: '#swagger-ui',
                presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
                layout: "BaseLayout",
                deepLinking: true,
                showExtensions: true,
                showCommonExtensions: true
            });
        };
    </script>
</body>
</html>
"""


@bp.route('/openapi.json')
def openapi_spec():
    """Return OpenAPI specification."""
    from flask import jsonify
    return jsonify(OPENAPI_SPEC)
