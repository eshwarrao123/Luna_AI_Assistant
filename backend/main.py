# /backend/main.py
import os
import json
import tempfile
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel

from database import (
    init_db,
    save_message,
    get_recent_messages,
    get_last_messages,
)
from ollama_client import OllamaClient
from intent import classify_intent
from tools import execute_tool
from memory_engine import (
    get_relevant_memories,
    inject_memories_into_system_prompt,
    extract_memories,
    save_memories,
    get_all_memories,
    delete_memory,
    clear_all_memories,
)
from settings import router as settings_router
from file_handler import is_image, extract_text, encode_image_b64, truncate_text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("luna.main")

BASE_SYSTEM_PROMPT = (
    "You are Luna, a helpful local AI assistant that runs entirely on the "
    "user's own device. You are concise, warm, and honest.\n\n"
    "STRICT RULES YOU MUST FOLLOW:\n"
    "1. You may ONLY state personal facts about the user that appear verbatim "
    "in the MEMORY STATE block below. No exceptions.\n"
    "2. You MUST NOT invent, infer, extrapolate, or hallucinate ANY personal "
    "detail — not hobbies, interests, profession, location, or anything else — "
    "unless it is explicitly listed in MEMORY STATE.\n"
    "3. If the user asks what you know about them, enumerate ONLY the items in "
    "MEMORY STATE and nothing else.\n"
    "4. If you are uncertain whether a fact is in MEMORY STATE, do NOT say it."
)

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOAD_EXTS = {".txt", ".pdf", ".png", ".jpg", ".jpeg"}
VISION_MODELS = ["llava-phi3", "llama3.2-vision", "llava"]

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

app.include_router(settings_router)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ExecuteRequest(BaseModel):
    tool: str
    params: dict = {}
    session_id: str = "default"


def _build_system_content() -> tuple[str, list[str]]:
    memories = get_relevant_memories(limit=10)
    memory_block = inject_memories_into_system_prompt(memories)
    system_content = f"{BASE_SYSTEM_PROMPT}\n\n{memory_block}"
    return system_content, [m["key"] for m in memories]


async def _extract_after_stream(session_id: str) -> None:
    try:
        convo = get_last_messages(session_id, limit=5)
        extracted = await extract_memories(convo, ollama)
        if extracted:
            log.info("Extracted %d new memories: %s", len(extracted), extracted)
        save_memories(extracted)
    except Exception:
        pass


@app.get("/health")
async def health():
    return {"status": "ok", "luna": True}


@app.get("/memories")
async def list_memories():
    return get_all_memories()


@app.delete("/memories/{memory_id}")
async def remove_memory(memory_id: int):
    return {"success": delete_memory(memory_id)}


@app.delete("/memories")
async def clear_memories():
    return {"success": True, "deleted": clear_all_memories()}


@app.post("/execute")
async def execute(req: ExecuteRequest):
    log.info("[main] /execute called: tool=%s params=%s", req.tool, req.params)
    result = execute_tool(req.tool, req.params)
    log.info("[main] /execute result: %s", result)
    save_message(req.session_id, "assistant", result.get("message", ""))
    return {"success": result.get("success", False), "message": result.get("message", "")}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    log.info("[main] /chat/stream message=%r session=%s", req.message, req.session_id)
    intent = await classify_intent(req.message, ollama)
    log.info("[main] intent result: %s", intent)

    save_message(req.session_id, "user", req.message)

    if intent.get("action") and intent["action"] != "chat":
        log.info("[main] >>> SENDING permission_request for action=%s", intent["action"])

        async def tool_gen():
            payload = json.dumps({"type": "permission_request", "action": intent})
            log.info("[main] emitting SSE: %s", payload)
            yield f"data: {payload}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return StreamingResponse(tool_gen(), media_type="text/event-stream", headers=SSE_HEADERS)

    system_content, memory_keys = _build_system_content()
    log.info("[main] chat path — streaming from Ollama")

    history = get_recent_messages(req.session_id, limit=10)
    messages = [{"role": "system", "content": system_content}, *history]

    async def event_gen():
        full = ""
        yield f"data: {json.dumps({'type': 'memories_used', 'keys': memory_keys})}\n\n"
        try:
            async for chunk in ollama.chat_stream(messages):
                full += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        except Exception as exc:
            err = f"[Luna: stream error: {exc}]"
            full += err
            yield f"data: {json.dumps({'type': 'chunk', 'content': err})}\n\n"
        finally:
            if full:
                save_message(req.session_id, "assistant", full)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
        background=BackgroundTask(_extract_after_stream, req.session_id),
    )


@app.post("/chat/upload")
async def chat_upload(
    message: str = Form(""),
    session_id: str = Form("default"),
    file: UploadFile = File(...),
):
    raw = await file.read()

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large — maximum is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTS))}",
        )

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    file_data: dict
    try:
        tmp.write(raw)
        tmp.close()
        tmp_path = Path(tmp.name)
        if is_image(filename):
            file_data = {"kind": "image", "image_b64": encode_image_b64(tmp_path)}
        else:
            file_data = {"kind": "text", "text": truncate_text(extract_text(tmp_path, filename))}
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    user_note = f"{message}\n[attached: {filename}]".strip()
    save_message(session_id, "user", user_note)

    system_content, memory_keys = _build_system_content()
    history = get_recent_messages(session_id, limit=10)
    base_history = history[:-1] if (history and history[-1]["role"] == "user") else history
    messages_list: list[dict] = [{"role": "system", "content": system_content}, *base_history]

    chosen_model = "qwen2.5:7b"
    prefix_note: str | None = None

    if file_data["kind"] == "image":
        vision = await ollama.first_available(VISION_MODELS)
        if vision:
            chosen_model = vision
            messages_list.append({
                "role": "user",
                "content": message or "Please describe this image in detail.",
                "images": [file_data["image_b64"]],
            })
        else:
            prefix_note = (
                "⚠️ No vision model is installed. "
                "Run `ollama pull llava-phi3` to enable image analysis.\n\n"
            )
            messages_list.append({
                "role": "user",
                "content": message or "(user sent an image — no vision model available)",
            })
    else:
        doc = file_data.get("text") or "(no text extracted)"
        messages_list.append({
            "role": "user",
            "content": (
                (message or "Please review this document.")
                + f'\n\n[Attached: {filename}]\n"""\n{doc}\n"""'
            ),
        })

    async def event_gen():
        full = ""
        yield f"data: {json.dumps({'type': 'memories_used', 'keys': memory_keys})}\n\n"
        if prefix_note:
            full += prefix_note
            yield f"data: {json.dumps({'type': 'chunk', 'content': prefix_note})}\n\n"
        try:
            async for chunk in ollama.chat_stream(messages_list, model=chosen_model):
                full += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        except Exception as exc:
            err = f"[Luna: stream error: {exc}]"
            full += err
            yield f"data: {json.dumps({'type': 'chunk', 'content': err})}\n\n"
        finally:
            if full:
                save_message(session_id, "assistant", full)
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
        background=BackgroundTask(_extract_after_stream, session_id),
    )