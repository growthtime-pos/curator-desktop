from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"


class SyncStatusResponse(BaseModel):
    backend: str = "connected"
    last_synced_at: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="User message")
    conversation_id: str | None = Field(default=None, description="Optional conversation identifier")
    space_key: str | None = Field(default=None, description="Optional Confluence space key override")
    top_k: int = Field(default=3, ge=1, le=10, description="Max number of Confluence docs to use")


class ConfluenceDocument(BaseModel):
    id: str
    title: str
    url: str
    excerpt: str


class SourceDocument(BaseModel):
    title: str
    url: str


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    sources: list[SourceDocument]
    retrieved_documents: list[ConfluenceDocument]
