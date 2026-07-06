import json
from typing import AsyncGenerator

import httpx

OLLAMA_BASE = "http://localhost:11434"
CHAT_URL = f"{OLLAMA_BASE}/api/chat"

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
