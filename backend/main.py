import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import init_db, save_message, get_recent_messages
from ollama_client import OllamaClient

SYSTEM_PROMPT = (
    "You are Luna, a helpful local AI assistant. "
    "You run entirely on the user's device."
)

ollama = OllamaClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


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
    session_id: str = "default"


@app.get("/health")
async def health():
    return {"status": "ok", "luna": True}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    # Persist the user message before streaming
    save_message(req.session_id, "user", req.message)

    # Build the messages list: system + history + current
    history = get_recent_messages(req.session_id, limit=10)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    # history already includes the just-saved user message; avoid duplicating it
    if not (messages and messages[-1].get("content") == req.message
            and messages[-1].get("role") == "user"):
        messages.append({"role": "user", "content": req.message})

    async def event_generator():
        full_response = ""
        try:
            async for chunk in ollama.chat_stream(messages):
                full_response += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"
        except Exception as e:  # noqa: BLE001
            err = f"[Luna: stream error: {e}]"
            full_response += err
            yield f"data: {json.dumps({'content': err})}\n\n"
        finally:
            if full_response:
                save_message(req.session_id, "assistant", full_response)
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
