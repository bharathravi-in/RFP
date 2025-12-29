from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from celery import Celery

from flask_socketio import SocketIO

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
celery = Celery()  # Will be configured in app factory
socketio = SocketIO()

# Compression
from flask_compress import Compress
gzip = Compress()
