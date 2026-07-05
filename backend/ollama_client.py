# import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"


class OllamaClient:
    """Client for talking to a locally running Ollama instance.

    Currently returns a mock string. The real async HTTP call is included
    below (commented) and ready to be enabled once Ollama is wired up.
    """

    def __init__(self, base_url: str = OLLAMA_URL) -> None:
        self.base_url = base_url

    async def chat(self, prompt: str, model: str = "qwen2.5:7b") -> str:
        # --- MOCK IMPLEMENTATION (active) ---
        return f"[mock:{model}] Luna would respond to: {prompt}"

        # --- REAL IMPLEMENTATION (enable when Ollama is running) ---
        # async with httpx.AsyncClient(timeout=120.0) as client:
        #     resp = await client.post(
        #         self.base_url,
        #         json={
        #             "model": model,
        #             "prompt": prompt,
        #             "stream": False,
        #         },
        #     )
        #     resp.raise_for_status()
        #     data = resp.json()
        #     return data.get("response", "")
