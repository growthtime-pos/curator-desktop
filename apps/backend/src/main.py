from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .chat_service import ChatDependencies, ChatService, SessionStore
from .models import CreateSessionRequest, ProviderConfig, RecommendSkillsRequest, SendMessageRequest, SessionSkillUpdateRequest
from .skills import SkillRegistry
from .tool_runner import ToolRunner

app = FastAPI(title="Curator Backend", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_service = ChatService(
    dependencies=ChatDependencies(skills=SkillRegistry(), tools=ToolRunner()),
    store=SessionStore(),
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/skills")
def list_skills(skillRootPaths: list[str] = Query(default=[])):
    provider_config = ProviderConfig(skillRootPaths=skillRootPaths)
    return chat_service.list_skills(provider_config=provider_config)


@app.post("/skills/recommend")
def recommend_skills(request: RecommendSkillsRequest):
    return chat_service.recommend_skills(request)


@app.post("/chat/sessions")
def create_session(request: CreateSessionRequest):
    return chat_service.create_session(request)


@app.get("/chat/sessions/{session_id}")
def get_session(session_id: str):
    session = chat_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@app.post("/chat/sessions/{session_id}/skills")
def activate_skill(session_id: str, request: SessionSkillUpdateRequest):
    session = chat_service.activate_skill(session_id, request)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@app.delete("/chat/sessions/{session_id}/skills/{skill_id}")
def remove_skill(session_id: str, skill_id: str):
    session = chat_service.remove_skill(session_id, skill_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@app.post("/chat/sessions/{session_id}/messages")
async def send_message(session_id: str, request: SendMessageRequest):
    session = await chat_service.send_message(session_id, request)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session
