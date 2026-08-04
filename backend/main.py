import sys
import os

# Add root directory to sys.path so 'backend' module is recognized when running from any CWD
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.router import router as api_router
from backend.memory.db import init_db

app = FastAPI(title="BYTE Desktop Automation Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    print("[BYTE Backend] Initializing local database and persistent storage...")
    init_db()

@app.on_event("shutdown")
def on_shutdown():
    print("[BYTE Backend] Shutting down automation engine services cleanly.")

app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
