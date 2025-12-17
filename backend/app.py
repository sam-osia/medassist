from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import (chat_router, planning_router, auth_router, tool_router,
                 projects_router, datasets_router, workflow_router, users_router,
                 caboodle_router)

import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Update CORS middleware with more specific configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:3000", "http://saman-B760M-GAMING-X-AX-DDR4:3000", "http://saman-b760m-gaming-x-ax-ddr4:3000"],  # Your React frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
    expose_headers=["*"]
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(chat_router, prefix="/api/chat")
app.include_router(planning_router, prefix="/api/planning")
app.include_router(tool_router, prefix="/api/tool")
app.include_router(tool_router, prefix="/api/tools")
app.include_router(workflow_router, prefix="/api/workflow")
app.include_router(projects_router, prefix="/api/projects")
app.include_router(datasets_router, prefix="/api/datasets")
app.include_router(users_router, prefix="/api/users")
app.include_router(caboodle_router, prefix="/api/caboodle")
