from datetime import datetime, UTC

from fastapi import FastAPI

from .schemas import ChatRequest, ChatResponse, HealthResponse, SyncStatusResponse
from .services.chat_service import ChatService

app = FastAPI(title="Curator Backend", version="0.3.0")
chat_service = ChatService()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@app.get("/v1/sync/status", response_model=SyncStatusResponse)
def sync_status() -> SyncStatusResponse:
    return SyncStatusResponse(last_synced_at=datetime.now(UTC).isoformat())


@app.post("/v1/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    return chat_service.build_response(payload)
