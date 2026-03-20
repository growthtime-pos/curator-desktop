from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ProviderProtocol = Literal["chat", "responses"]
ChatRole = Literal["system", "user", "assistant", "tool"]


class ProviderConfig(BaseModel):
    api_base_url: str = Field(default="", alias="apiBaseUrl")
    api_key: str = Field(default="", alias="apiKey")
    model: str = "gpt-4.1-mini"
    provider_protocol: ProviderProtocol = Field(default="chat", alias="providerProtocol")
    skill_root_paths: list[str] = Field(default_factory=list, alias="skillRootPaths")

    model_config = {"populate_by_name": True}


class ToolParameterSchema(BaseModel):
    type: str = "object"
    properties: dict[str, Any] = Field(default_factory=dict)
    required: list[str] = Field(default_factory=list)
    additionalProperties: bool | dict[str, Any] = False


class SkillToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: ToolParameterSchema = Field(alias="inputSchema")

    model_config = {"populate_by_name": True}


class SkillToolManifestEntry(SkillToolDefinition):
    command: list[str]
    allowed_workdir: str | None = Field(default=None, alias="allowedWorkdir")
    timeout_ms: int = Field(default=15_000, alias="timeoutMs", ge=1_000, le=120_000)

    model_config = {"populate_by_name": True}


class SkillToolManifest(BaseModel):
    tools: list[SkillToolManifestEntry] = Field(default_factory=list)


class SkillSummary(BaseModel):
    id: str
    name: str
    description: str
    root_path: str = Field(alias="rootPath")
    source_path: str = Field(alias="sourcePath")
    reference_files: list[str] = Field(default_factory=list, alias="referenceFiles")
    tool_definitions: list[SkillToolDefinition] = Field(default_factory=list, alias="toolDefinitions")
    load_errors: list[str] = Field(default_factory=list, alias="loadErrors")

    model_config = {"populate_by_name": True}


class SkillRecord(SkillSummary):
    body: str
    manifest_tools: list[SkillToolManifestEntry] = Field(default_factory=list, alias="manifestTools")
    script_candidates: list[str] = Field(default_factory=list, alias="scriptCandidates")

    model_config = {"populate_by_name": True}


class SkillRecommendation(BaseModel):
    skill: SkillSummary
    score: float
    reason: str
    explicit: bool = False


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ChatMessage(BaseModel):
    id: str
    role: ChatRole
    content: str
    created_at: datetime = Field(alias="createdAt")
    applied_skill_ids: list[str] = Field(default_factory=list, alias="appliedSkillIds")
    applied_skill_names: list[str] = Field(default_factory=list, alias="appliedSkillNames")
    trace: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    tool_name: str | None = Field(default=None, alias="toolName")
    tool_call_id: str | None = Field(default=None, alias="toolCallId")
    requested_tool_calls: list[ToolCall] = Field(default_factory=list, alias="requestedToolCalls")

    model_config = {"populate_by_name": True}


class ChatSession(BaseModel):
    session_id: str = Field(alias="sessionId")
    messages: list[ChatMessage] = Field(default_factory=list)
    active_skill_ids: list[str] = Field(default_factory=list, alias="activeSkillIds")
    pending_skill_suggestions: list[SkillRecommendation] = Field(
        default_factory=list,
        alias="pendingSkillSuggestions",
    )
    provider_config_snapshot: ProviderConfig = Field(alias="providerConfigSnapshot")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


class CreateSessionRequest(BaseModel):
    provider_config: ProviderConfig = Field(alias="providerConfig")

    model_config = {"populate_by_name": True}


class SessionSkillUpdateRequest(BaseModel):
    skill_id: str = Field(alias="skillId")

    model_config = {"populate_by_name": True}


class RecommendSkillsRequest(BaseModel):
    message: str
    active_skill_ids: list[str] = Field(default_factory=list, alias="activeSkillIds")
    provider_config: ProviderConfig | None = Field(default=None, alias="providerConfig")

    model_config = {"populate_by_name": True}


class SendMessageRequest(BaseModel):
    content: str
    provider_config: ProviderConfig | None = Field(default=None, alias="providerConfig")

    model_config = {"populate_by_name": True}


class ProviderRequest(BaseModel):
    messages: list[ChatMessage]
    system_instructions: list[str] = Field(default_factory=list, alias="systemInstructions")
    tool_definitions: list[SkillToolDefinition] = Field(default_factory=list, alias="toolDefinitions")
    stream: bool = False

    model_config = {"populate_by_name": True}


class ProviderResponse(BaseModel):
    output_text: str = Field(default="", alias="outputText")
    tool_calls: list[ToolCall] = Field(default_factory=list, alias="toolCalls")
    warnings: list[str] = Field(default_factory=list)
    raw_response: dict[str, Any] = Field(default_factory=dict, alias="rawResponse")

    model_config = {"populate_by_name": True}


class ToolExecutionResult(BaseModel):
    tool_call_id: str = Field(alias="toolCallId")
    tool_name: str = Field(alias="toolName")
    content: str
    is_error: bool = Field(alias="isError")
    trace_line: str = Field(alias="traceLine")

    model_config = {"populate_by_name": True}
