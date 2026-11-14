"""
Celery Worker Launcher Script
Runs the Celery background worker for HookFlow.
On Windows, uses the 'solo' or 'threads' execution pool.
"""
import sys
import os

# Ensure current directory is on python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.celery_app import celery_app

if __name__ == "__main__":
    # Windows compatibility check: default to 'solo' pool on win32
    pool_arg = ["-P", "solo"] if sys.platform == "win32" else []
    
    argv = [
        "worker",
        "--loglevel=info",
        "-Q", "webhooks,celery",
        *pool_arg
    ]
    celery_app.worker_main(argv=argv)
