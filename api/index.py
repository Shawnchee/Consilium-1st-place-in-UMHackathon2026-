import sys
import os

# Add the root directory to sys.path so 'agent' can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.server import app

# Vercel needs the app object to be named 'app' at the module level
# (which it already is in agent.server)
