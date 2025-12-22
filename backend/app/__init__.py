import os
from flask import Flask
from .config import config
from .extensions import db, migrate, jwt, cors


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
    cors.init_app(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Create upload folder
    upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    
    # Register blueprints
    from .routes import auth, projects, documents, questions, answers, knowledge, export, analytics, ai, folders, preview, sections, ai_config, agent_config, users, organizations, invitations, versions, compliance, answer_library, go_no_go, notifications
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

    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'service': 'autorespond-api'}
    
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
