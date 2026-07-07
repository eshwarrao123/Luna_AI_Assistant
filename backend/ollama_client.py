# /backend/ollama_client.py
import json
from typing import AsyncGenerator

import httpx

OLLAMA_BASE = "http://localhost:11434"
CHAT_URL = f"{OLLAMA_BASE}/api/chat"
TAGS_URL = f"{OLLAMA_BASE}/api/tags"

CONNECTION_ERROR_MSG = (
    "[Luna: Ollama is not running. Please start it with 'ollama serve']"
)


class OllamaClient:
    """Async client for a locally running Ollama instance."""

    def __init__(self, base_url: str = CHAT_URL) -> None:
        self.base_url = base_url

    async def chat_stream(
        self,
        messages: list[dict],
        model: str = "qwen2.5:7b",
        options: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        payload = {"model": model, "messages": messages, "stream": True}
        if options:
            payload["options"] = options
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", self.base_url, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
                        if data.get("done"):
                            break
        except (httpx.ConnectError, httpx.ConnectTimeout, ConnectionError):
            yield CONNECTION_ERROR_MSG
        except httpx.HTTPStatusError as e:
            yield f"[Luna: Ollama returned an error: {e.response.status_code}]"

    async def chat(
        self,
        messages: list[dict],
        model: str = "qwen2.5:7b",
        options: dict | None = None,
    ) -> str:
        parts: list[str] = []
        async for chunk in self.chat_stream(messages, model=model, options=options):
            parts.append(chunk)
        return "".join(parts)

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(TAGS_URL)
                resp.raise_for_status()
                data = resp.json()
                return [m.get("name", "") for m in data.get("models", [])]
        except Exception:  # noqa: BLE001
            return []

    async def has_model(self, name: str) -> bool:
        models = await self.list_models()
        base = name.split(":")[0]
        return any(m == name or m.split(":")[0] == base for m in models)

    async def first_available(self, candidates: list[str]) -> str | None:
        models = await self.list_models()
        exact = set(models)
        bases = {m.split(":")[0]: m for m in models}
        for c in candidates:
            if c in exact:
                return c
            b = c.split(":")[0]
            if b in bases:
                return bases[b]
        return None