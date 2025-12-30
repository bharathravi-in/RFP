import os
from flask import Flask
from .config import config
from .extensions import db, migrate, jwt, cors, socketio, gzip


def create_app(config_name=None):
    """Application factory for creating Flask app instances."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")
    gzip.init_app(app)
    
    cors.init_app(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Initialize OpenTelemetry (if enabled via OTEL_ENABLED=true)
    try:
        from app.utils.telemetry import init_telemetry, get_telemetry_status
        init_telemetry(app)
    except ImportError:
        pass  # Telemetry dependencies not installed, skip
    except Exception as e:
        print(f"Warning: Could not initialize telemetry: {e}")
    
    # Register Socket.IO handlers
    from . import socket_events
    
    # Create upload folder
    upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    
    # Register blueprints
    from .routes import auth, projects, documents, questions, answers, knowledge, export, analytics, ai, folders, preview, sections, ai_config, agent_config, users, organizations, invitations, versions, compliance, answer_library, go_no_go, notifications, comments, smart_search, activity, copilot
    from .routes.agents import agents_bp
    from .routes.profiles import profiles_bp
    
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(projects.bp, url_prefix='/api/projects')
    app.register_blueprint(documents.bp, url_prefix='/api/documents')
    app.register_blueprint(questions.bp, url_prefix='/api/questions')
    app.register_blueprint(answers.bp, url_prefix='/api/answers')
    app.register_blueprint(knowledge.bp, url_prefix='/api/knowledge')
    app.register_blueprint(export.bp, url_prefix='/api/export')
    app.register_blueprint(analytics.bp, url_prefix='/api/analytics')
    app.register_blueprint(ai.bp, url_prefix='/api/ai')
    app.register_blueprint(folders.bp, url_prefix='/api/folders')
    app.register_blueprint(preview.bp, url_prefix='/api/preview')
    app.register_blueprint(sections.bp)  # Uses /api prefix defined in blueprint
    app.register_blueprint(agents_bp)  # Multi-agent RFP analysis system
    app.register_blueprint(profiles_bp, url_prefix='/api/knowledge')  # Knowledge profiles
    app.register_blueprint(ai_config.bp)  # AI configuration management
    app.register_blueprint(agent_config.bp)  # Agent-specific AI configuration
    app.register_blueprint(users.bp, url_prefix='/api/users')  # User profile management
    app.register_blueprint(organizations.bp, url_prefix='/api/organizations')  # Organization CRUD
    app.register_blueprint(invitations.bp)  # Team invitations (url_prefix in blueprint)
    app.register_blueprint(versions.bp, url_prefix='/api')  # Document versioning
    app.register_blueprint(compliance.bp, url_prefix='/api')  # Compliance matrix
    app.register_blueprint(answer_library.bp, url_prefix='/api/answer-library')  # Reusable Q&A library
    app.register_blueprint(go_no_go.bp, url_prefix='/api')  # Go/No-Go analysis
    app.register_blueprint(notifications.bp, url_prefix='/api/notifications')  # User notifications
    app.register_blueprint(comments.bp, url_prefix='/api/comments')  # Inline comments & @mentions
    app.register_blueprint(smart_search.bp, url_prefix='/api/search')  # Smart natural language search
    app.register_blueprint(activity.bp, url_prefix='/api/activity')  # Activity timeline
    app.register_blueprint(copilot.bp)  # Co-Pilot AI chat

    # PPT generation
    from .routes import ppt
    from .routes import export_templates
    app.register_blueprint(ppt.bp, url_prefix='/api/ppt')  # PowerPoint generation
    app.register_blueprint(export_templates.bp, url_prefix='/api/export-templates')  # Export templates

    # Enhancement features (usage tracking, cache, export)
    from .routes import enhancements
    app.register_blueprint(enhancements.bp)  # /api prefix defined in blueprint

    # Document Chat
    from .routes import document_chat
    app.register_blueprint(document_chat.bp)  # Document-specific AI chat

    # Knowledge Chat
    from .routes import knowledge_chat
    app.register_blueprint(knowledge_chat.bp, url_prefix='/api/knowledge')  # Knowledge-item AI chat

    # Proposal Chat
    from .routes import proposal_chat
    app.register_blueprint(proposal_chat.bp)  # Chat-style proposal generation

    # Webhooks (Enterprise feature)
    from .routes import webhooks
    app.register_blueprint(webhooks.bp, url_prefix='/api/webhooks')  # Webhook management

    # Super Admin (Platform-level administration)
    from .routes import superadmin
    app.register_blueprint(superadmin.bp)  # /api/superadmin/*

    # Settings (Agent configuration, resilience settings)
    from .routes import settings
    app.register_blueprint(settings.bp)  # /api/settings/*

    # Health check endpoints (enhanced)
    from .routes import health, api_docs
    app.register_blueprint(health.bp)  # /health, /ready, /metrics at root
    app.register_blueprint(api_docs.bp, url_prefix='/api')  # /api/docs, /api/openapi.json

    # Initialize middleware
    from .middleware import init_error_handlers, init_request_logging, add_rate_limit_headers
    init_error_handlers(app)
    init_request_logging(app)
    app.after_request(add_rate_limit_headers)
    
    # Health check endpoint with telemetry status
    @app.route('/api/health')
    def health_check():
        response = {'status': 'healthy', 'service': 'autorespond-api'}
        try:
            from app.utils.telemetry import get_telemetry_status
            response['telemetry'] = get_telemetry_status()
        except ImportError:
            response['telemetry'] = {'enabled': False}
        return response
    
    # Auto-seed section types on first request
    @app.before_request
    def seed_data_on_first_request():
        """Seed section types and filter dimensions if they don't exist (runs once on first request)"""
        if not getattr(app, '_seeded', False):
            try:
                from .models import seed_section_types, RFPSectionType
                from .models import seed_filter_dimensions, FilterDimension
                
                # Seed section types
                if RFPSectionType.query.count() == 0:
                    seed_section_types(db.session)
                    print("Auto-seeded section types on first request")
                
                # Seed filter dimensions
                if FilterDimension.query.count() == 0:
                    seed_filter_dimensions(db.session)
                    print("Auto-seeded filter dimensions on first request")
                
                app._seeded = True
            except Exception as e:
                # Don't fail startup if seeding fails
                print(f"Warning: Could not seed data: {e}")
                app._seeded = True  # Don't retry on every request
    
    return app
