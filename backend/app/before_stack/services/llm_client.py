"""
llm_client.py — Phase B-4 (LLM 추상화 레이어)
Vertex AI → Ollama 교체를 대비해 BaseLLMClient 를 정의한다.
실제 LLM 호출은 이 모듈을 통해서만 이뤄진다.

사용:
    from backend.app.before_stack.services.llm_client import get_llm_client
    llm = get_llm_client("vertex")   # 또는 "ollama"
    result = await llm.check(system_prompt, user_prompt)

환경변수:
    LLM_PROVIDER=vertex  (기본값, Phase B)
    GOOGLE_APPLICATION_CREDENTIALS=/path/key.json  (Vertex AI)
    GCP_PROJECT_ID=your_project_id                 (Vertex AI)
"""

import json
import re
from abc import ABC, abstractmethod

from backend.app.before_stack.core.settings import (
    GCP_PROJECT_ID,
    GCP_LOCATION,
    VERTEX_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    LLM_PROVIDER,
)


# ── 추상 기반 클래스 ──────────────────────────────────────────────────────────

class BaseLLMClient(ABC):
    """모든 LLM 클라이언트가 구현해야 하는 인터페이스."""

    @abstractmethod
    async def check(self, system_prompt: str, user_prompt: str) -> dict:
        """
        system_prompt + user_prompt 를 LLM 에 보내고 JSON dict 를 반환한다.
        실패 시 예외를 raise 하지 않고 {"error": str, "status": "WARNING"} 반환.
        """


# ── JSON 파싱 유틸 ─────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict:
    """JSON 파싱. 마크다운 코드블록 감싸진 경우도 처리."""
    code_block = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if code_block:
        text = code_block.group(1)
    obj_match = re.search(r'\{[\s\S]*\}', text)
    if obj_match:
        return json.loads(obj_match.group())
    return json.loads(text)


def _error_response(e: Exception) -> dict:
    return {
        "status":     "WARNING",
        "severity":   "LOW",
        "issues":     [],
        "confidence": "LOW",
        "error":      str(e),
    }


# ── Vertex AI 클라이언트 ──────────────────────────────────────────────────────

class VertexAIClient(BaseLLMClient):
    """
    Google Vertex AI 클라이언트 (Phase B 기본).
    generate_content() 는 동기 API 이므로 asyncio.to_thread() 로 래핑.
    """

    def __init__(self, model: str | None = None):
        import vertexai
        from vertexai.generative_models import GenerativeModel

        model_name = model or VERTEX_MODEL
        vertexai.init(project=GCP_PROJECT_ID, location=GCP_LOCATION)
        self._model = GenerativeModel(model_name)

    async def check(self, system_prompt: str, user_prompt: str) -> dict:
        import asyncio
        from vertexai.generative_models import GenerationConfig

        combined = f"{system_prompt}\n\n{user_prompt}"

        def _sync_call() -> str:
            response = self._model.generate_content(
                combined,
                generation_config=GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            return response.text.strip()

        try:
            text = await asyncio.to_thread(_sync_call)
            return _parse_json(text)
        except Exception as e:
            return _error_response(e)


# ── Ollama 클라이언트 (로컬 LLM) ──────────────────────────────────────────────

class OllamaClient(BaseLLMClient):
    """
    로컬 Ollama 서버 클라이언트.
    Vertex AI → Ollama 전환 시 get_llm_client("ollama") 로만 교체.

    사전 조건:
        ollama pull qwen2.5:14b
        ollama serve
    """

    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
    ):
        self.model    = model    or OLLAMA_MODEL
        self.base_url = base_url or OLLAMA_BASE_URL

    async def check(self, system_prompt: str, user_prompt: str) -> dict:
        import httpx

        payload = {
            "model":  self.model,
            "prompt": f"{system_prompt}\n\n{user_prompt}",
            "stream": False,
            "format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )
            resp.raise_for_status()
            raw = resp.json().get("response", "{}")
            return json.loads(raw)
        except Exception as e:
            return _error_response(e)


# ── 팩토리 함수 ───────────────────────────────────────────────────────────────

def get_llm_client(provider: str | None = None) -> BaseLLMClient:
    """
    provider: 'vertex' | 'ollama'
    None 이면 settings.LLM_PROVIDER 값 사용.
    FastAPI lifespan 에서 1회 생성해 app.state 에 저장한다.
    """
    p = (provider or LLM_PROVIDER).lower()
    if p == "vertex":
        return VertexAIClient()
    if p == "ollama":
        return OllamaClient()
    raise ValueError(
        f"지원하지 않는 LLM provider: {p!r}. "
        "'vertex' / 'ollama' 중 선택."
    )
