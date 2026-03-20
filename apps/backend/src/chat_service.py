from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from .models import (
    ChatMessage,
    ChatSession,
    CreateSessionRequest,
    ProviderConfig,
    ProviderRequest,
    RecommendSkillsRequest,
    SendMessageRequest,
    SessionSkillUpdateRequest,
    SkillRecommendation,
    SkillSummary,
    ToolExecutionResult,
)
from .providers import ProviderError, get_provider_adapter
from .skills import SkillRegistry
from .tool_runner import ToolRunner


@dataclass(slots=True)
class ChatDependencies:
    skills: SkillRegistry
    tools: ToolRunner


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, ChatSession] = {}

    def create(self, request: CreateSessionRequest) -> ChatSession:
        now = _utcnow()
        session = ChatSession(
            sessionId=f"session_{uuid4().hex}",
            messages=[],
            activeSkillIds=[],
            pendingSkillSuggestions=[],
            providerConfigSnapshot=request.provider_config,
            createdAt=now,
            updatedAt=now,
        )
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> ChatSession | None:
        return self._sessions.get(session_id)

    def save(self, session: ChatSession) -> ChatSession:
        session.updated_at = _utcnow()
        self._sessions[session.session_id] = session
        return session


class ChatService:
    def __init__(self, dependencies: ChatDependencies, store: SessionStore) -> None:
        self._dependencies = dependencies
        self._store = store

    def list_skills(self, provider_config: ProviderConfig | None = None) -> list[SkillSummary]:
        records = self._dependencies.skills.list_skills(provider_config)
        return [SkillSummary.model_validate(record.model_dump(by_alias=True)) for record in records]

    def recommend_skills(self, request: RecommendSkillsRequest) -> list[SkillRecommendation]:
        return self._dependencies.skills.recommend(
            message=request.message,
            active_skill_ids=request.active_skill_ids,
            provider_config=request.provider_config,
        )

    def create_session(self, request: CreateSessionRequest) -> ChatSession:
        return self._store.create(request)

    def get_session(self, session_id: str) -> ChatSession | None:
        return self._store.get(session_id)

    def activate_skill(self, session_id: str, request: SessionSkillUpdateRequest) -> ChatSession | None:
        session = self._store.get(session_id)
        if session is None:
            return None
        if request.skill_id not in session.active_skill_ids:
            session.active_skill_ids.append(request.skill_id)
        session.pending_skill_suggestions = [
            item for item in session.pending_skill_suggestions if item.skill.id != request.skill_id
        ]
        return self._store.save(session)

    def remove_skill(self, session_id: str, skill_id: str) -> ChatSession | None:
        session = self._store.get(session_id)
        if session is None:
            return None
        session.active_skill_ids = [active_id for active_id in session.active_skill_ids if active_id != skill_id]
        return self._store.save(session)

    async def send_message(self, session_id: str, request: SendMessageRequest) -> ChatSession | None:
        session = self._store.get(session_id)
        if session is None:
            return None

        if request.provider_config is not None:
            session.provider_config_snapshot = request.provider_config
        provider_config = session.provider_config_snapshot

        user_message = ChatMessage(
            id=f"msg_{uuid4().hex}",
            role="user",
            content=request.content.strip(),
            createdAt=_utcnow(),
        )
        session.messages.append(user_message)
        session.pending_skill_suggestions = self._dependencies.skills.recommend(
            message=request.content,
            active_skill_ids=session.active_skill_ids,
            provider_config=provider_config,
        )

        active_skills = [
            skill
            for skill_id in session.active_skill_ids
            if (skill := self._dependencies.skills.get_skill(skill_id, provider_config)) is not None
        ]
        system_instructions = [
            "You are Curator Desktop, a concise assistant embedded in a desktop app.",
            "Use only the active skills and declared tools that the app has attached to this request.",
            *self._dependencies.skills.render_skill_context(active_skills),
        ]

        trace: list[str] = []
        warnings: list[str] = []
        assistant_text = ""
        tool_messages: list[ChatMessage] = []

        if provider_config.api_base_url and provider_config.model:
            adapter = get_provider_adapter(provider_config.provider_protocol)
            try:
                assistant_text, tool_messages, provider_warnings = await self._run_provider_loop(
                    adapter=adapter,
                    provider_config=provider_config,
                    session_messages=session.messages,
                    system_instructions=system_instructions,
                    active_skills=active_skills,
                    trace=trace,
                )
                warnings.extend(provider_warnings)
            except ProviderError as exc:
                warnings.append(f"Provider request failed: {exc}")
                assistant_text = self._build_error_fallback(request.content, active_skills, warnings)
        else:
            warnings.append("Provider is not configured; using local mock response.")
            assistant_text = self._build_mock_response(request.content, active_skills)

        session.messages.extend(tool_messages)
        session.messages.append(
            ChatMessage(
                id=f"msg_{uuid4().hex}",
                role="assistant",
                content=assistant_text,
                createdAt=_utcnow(),
                appliedSkillIds=[skill.id for skill in active_skills],
                appliedSkillNames=[skill.name for skill in active_skills],
                trace=trace,
                warnings=warnings,
            )
        )
        return self._store.save(session)

    async def _run_provider_loop(
        self,
        adapter,
        provider_config: ProviderConfig,
        session_messages: list[ChatMessage],
        system_instructions: list[str],
        active_skills,
        trace: list[str],
    ) -> tuple[str, list[ChatMessage], list[str]]:
        tool_messages: list[ChatMessage] = []
        warnings: list[str] = []
        working_messages = list(session_messages)
        assistant_text = ""

        for _ in range(4):
            provider_response = await adapter.generate(
                provider_config,
                ProviderRequest(
                    messages=working_messages,
                    systemInstructions=system_instructions,
                    toolDefinitions=[tool for skill in active_skills for tool in skill.tool_definitions],
                    stream=False,
                ),
            )
            warnings.extend(provider_response.warnings)
            assistant_text = provider_response.output_text.strip()
            if not provider_response.tool_calls:
                break

            working_messages.append(
                ChatMessage(
                    id=f"msg_{uuid4().hex}",
                    role="assistant",
                    content=assistant_text or "",
                    createdAt=_utcnow(),
                    requestedToolCalls=provider_response.tool_calls,
                )
            )
            tool_results = await self._execute_tool_calls(active_skills, provider_response.tool_calls)
            for result in tool_results:
                trace.append(result.trace_line)
                message = ChatMessage(
                    id=f"msg_{uuid4().hex}",
                    role="tool",
                    content=result.content,
                    createdAt=_utcnow(),
                    toolName=result.tool_name,
                    toolCallId=result.tool_call_id,
                    warnings=["Tool execution error"] if result.is_error else [],
                )
                tool_messages.append(message)
                working_messages.append(message)

            if not tool_results:
                warnings.append("Provider requested undeclared tools only; no tool results were returned.")
                break

        if assistant_text:
            return assistant_text, tool_messages, warnings
        return self._build_mock_response(session_messages[-1].content, active_skills), tool_messages, warnings

    async def _execute_tool_calls(self, active_skills, tool_calls) -> list[ToolExecutionResult]:
        executions: list[ToolExecutionResult] = []
        for tool_call in tool_calls:
            skill = next(
                (
                    candidate
                    for candidate in active_skills
                    if any(tool.name == tool_call.name for tool in candidate.manifest_tools)
                ),
                None,
            )
            if skill is None:
                executions.append(
                    ToolExecutionResult(
                        toolCallId=tool_call.id,
                        toolName=tool_call.name,
                        content=f"Tool '{tool_call.name}' is unavailable for the active skills.",
                        isError=True,
                        traceLine=f"Blocked undeclared tool: {tool_call.name}",
                    )
                )
                continue
            executions.append(await self._dependencies.tools.execute(skill, tool_call))
        return executions

    def _build_mock_response(self, prompt: str, active_skills) -> str:
        skill_clause = (
            f"Active skills: {', '.join(skill.name for skill in active_skills)}."
            if active_skills
            else "No active skills."
        )
        return (
            f"Mock response for: \"{prompt}\"\n\n"
            f"{skill_clause}\n"
            "The backend API is wired, but no remote OpenAI-compatible provider is configured yet."
        )

    def _build_error_fallback(self, prompt: str, active_skills, warnings: list[str]) -> str:
        skill_names = ", ".join(skill.name for skill in active_skills) or "none"
        return (
            f"I could not reach the configured provider for \"{prompt}\".\n"
            f"Active skills: {skill_names}.\n"
            f"Latest warning: {warnings[-1]}"
        )


def _utcnow() -> datetime:
    return datetime.now(UTC)
