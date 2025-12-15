from celery import Celery
from app import create_app
from app.config import Config

def make_celery(app_name=__name__):
    """Create and configure Celery instance."""
    celery = Celery(
        app_name,
        broker=Config.CELERY_BROKER_URL,
        backend=Config.CELERY_RESULT_BACKEND
    )
    
    # Optional: integrate with Flask app context
    flask_app = create_app()
    
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    return celery

celery = make_celery()

# Import tasks to register them
from app import tasks  # noqa: F401, E402

