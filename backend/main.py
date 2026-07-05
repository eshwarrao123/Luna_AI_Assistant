from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize SQLite tables
    init_db()
    yield
    # Shutdown: nothing to clean up yet


app = FastAPI(title="Luna Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


@app.get("/health")
async def health():
    return {"status": "ok", "luna": True}


@app.post("/chat")
async def chat(req: ChatRequest):
    # Mock response for now
    return {"response": f"Luna received: {req.message}"}
