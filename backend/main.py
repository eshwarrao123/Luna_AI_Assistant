import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import init_db, save_message, get_recent_messages
from ollama_client import OllamaClient
from intent import classify_intent
from tools import execute_tool

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


class ExecuteRequest(BaseModel):
    tool: str
    params: dict = {}
    session_id: str = "default"


@app.get("/health")
async def health():
    return {"status": "ok", "luna": True}


@app.post("/execute")
async def execute(req: ExecuteRequest):
    result = execute_tool(req.tool, req.params)
    # Persist the action outcome as an assistant message
    save_message(req.session_id, "assistant", result.get("message", ""))
    return {"success": result.get("success", False), "message": result.get("message", "")}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    # Classify intent BEFORE anything else
    intent = await classify_intent(req.message, ollama)

    # Always persist the user message
    save_message(req.session_id, "user", req.message)

    # --- TOOL PATH: request permission, do not call Ollama for a reply ---
    if intent.get("action") and intent["action"] != "chat":
        async def tool_generator():
            yield f"data: {json.dumps({'type': 'permission_request', 'action': intent})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return StreamingResponse(
            tool_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # --- CHAT PATH: normal streaming response ---
    history = get_recent_messages(req.session_id, limit=10)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)

    async def event_generator():
        full_response = ""
        try:
            async for chunk in ollama.chat_stream(messages):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        except Exception as e:  # noqa: BLE001
            err = f"[Luna: stream error: {e}]"
            full_response += err
            yield f"data: {json.dumps({'type': 'chunk', 'content': err})}\n\n"
        finally:
            if full_response:
                save_message(req.session_id, "assistant", full_response)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
