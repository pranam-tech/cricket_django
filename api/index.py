import os
import sys

# Add the backend directory to the path so we can import cricket_backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from cricket_backend.wsgi import application

app = application
