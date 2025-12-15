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
    from .routes import auth, projects, documents, questions, answers, knowledge, export, analytics
    
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(projects.bp, url_prefix='/api/projects')
    app.register_blueprint(documents.bp, url_prefix='/api/documents')
    app.register_blueprint(questions.bp, url_prefix='/api/questions')
    app.register_blueprint(answers.bp, url_prefix='/api/answers')
    app.register_blueprint(knowledge.bp, url_prefix='/api/knowledge')
    app.register_blueprint(export.bp, url_prefix='/api/export')
    app.register_blueprint(analytics.bp, url_prefix='/api/analytics')
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'service': 'autorespond-api'}
    
    return app
