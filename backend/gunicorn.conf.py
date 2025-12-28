"""
Gunicorn configuration file for production.

Usage:
    gunicorn -c gunicorn.conf.py "app:create_app()"
"""
import os
import multiprocessing

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "gthread"
threads = int(os.getenv("GUNICORN_THREADS", 2))
timeout = 120  # Extended for long LLM responses
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%({X-Request-ID}i)s %(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "rfp-api"

# Reload
reload = os.getenv("FLASK_ENV") == "development"
