from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from typing import Any
from urllib import error, request

from .models import ChatMessage, ProviderConfig, ProviderRequest, ProviderResponse, ToolCall


class ProviderError(RuntimeError):
    pass


class ProviderAdapter(ABC):
    protocol: str
    supports_tools: bool = True

    @abstractmethod
    async def generate(self, config: ProviderConfig, provider_request: ProviderRequest) -> ProviderResponse:
        raise NotImplementedError

    async def _post_json(self, url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
        def _send() -> dict[str, Any]:
            encoded = json.dumps(payload).encode("utf-8")
            req = request.Request(url=url, data=encoded, headers=headers, method="POST")
            try:
                with request.urlopen(req, timeout=60) as response:
                    return json.loads(response.read().decode("utf-8"))
            except error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="ignore")
                raise ProviderError(f"{exc.code} {exc.reason}: {body}") from exc
            except error.URLError as exc:
                raise ProviderError(str(exc.reason)) from exc

        return await asyncio.to_thread(_send)

    def _auth_headers(self, config: ProviderConfig) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if config.api_key:
            headers["Authorization"] = f"Bearer {config.api_key}"
        return headers


class OpenAIChatAdapter(ProviderAdapter):
    protocol = "chat"

    async def generate(self, config: ProviderConfig, provider_request: ProviderRequest) -> ProviderResponse:
        payload: dict[str, Any] = {
            "model": config.model,
            "messages": self._serialize_messages(provider_request),
            "stream": provider_request.stream,
        }
        if provider_request.tool_definitions:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema.model_dump(by_alias=True),
                    },
                }
                for tool in provider_request.tool_definitions
            ]

        url = config.api_base_url.rstrip("/") + "/chat/completions"
        raw_response = await self._post_json(url, self._auth_headers(config), payload)
        choices = raw_response.get("choices") or []
        if not choices:
            raise ProviderError("Provider returned no choices.")

        message = choices[0].get("message") or {}
        content = self._coerce_content(message.get("content"))
        tool_calls: list[ToolCall] = []
        for tool_call in message.get("tool_calls") or []:
            function = tool_call.get("function") or {}
            arguments = function.get("arguments") or "{}"
            tool_calls.append(
                ToolCall(
                    id=tool_call.get("id") or f"call_{function.get('name', 'tool')}",
                    name=function.get("name") or "tool",
                    arguments=self._parse_arguments(arguments),
                )
            )

        return ProviderResponse(outputText=content, toolCalls=tool_calls, rawResponse=raw_response)

    def _serialize_messages(self, provider_request: ProviderRequest) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": instruction}
            for instruction in provider_request.system_instructions
            if instruction.strip()
        ]
        for message in provider_request.messages:
            payload: dict[str, Any] = {"role": message.role, "content": message.content}
            if message.role == "tool":
                payload["tool_call_id"] = message.tool_call_id
                payload["name"] = message.tool_name
            if message.requested_tool_calls:
                payload["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.name,
                            "arguments": json.dumps(tool_call.arguments),
                        },
                    }
                    for tool_call in message.requested_tool_calls
                ]
            messages.append(payload)
        return messages

    def _coerce_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if text:
                        parts.append(str(text))
            return "\n".join(parts)
        return ""

    def _parse_arguments(self, raw_arguments: str) -> dict[str, Any]:
        try:
            parsed = json.loads(raw_arguments)
        except json.JSONDecodeError:
            return {"raw": raw_arguments}
        return parsed if isinstance(parsed, dict) else {"value": parsed}


class OpenAIResponsesAdapter(ProviderAdapter):
    protocol = "responses"

    async def generate(self, config: ProviderConfig, provider_request: ProviderRequest) -> ProviderResponse:
        payload: dict[str, Any] = {
            "model": config.model,
            "input": self._serialize_input(provider_request),
            "stream": provider_request.stream,
        }
        if provider_request.tool_definitions:
            payload["tools"] = [
                {
                    "type": "function",
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.input_schema.model_dump(by_alias=True),
                }
                for tool in provider_request.tool_definitions
            ]

        url = config.api_base_url.rstrip("/") + "/responses"
        raw_response = await self._post_json(url, self._auth_headers(config), payload)

        output_text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for item in raw_response.get("output") or []:
            item_type = item.get("type")
            if item_type == "message":
                for content in item.get("content") or []:
                    text = content.get("text")
                    if text:
                        output_text_parts.append(str(text))
            if item_type == "function_call":
                arguments = item.get("arguments") or "{}"
                tool_calls.append(
                    ToolCall(
                        id=item.get("call_id") or item.get("id") or f"call_{item.get('name', 'tool')}",
                        name=item.get("name") or "tool",
                        arguments=self._parse_arguments(arguments),
                    )
                )

        return ProviderResponse(
            outputText="\n".join(part for part in output_text_parts if part),
            toolCalls=tool_calls,
            rawResponse=raw_response,
        )

    def _serialize_input(self, provider_request: ProviderRequest) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for instruction in provider_request.system_instructions:
            if instruction.strip():
                items.append(
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": instruction}],
                    }
                )

        for message in provider_request.messages:
            items.extend(self._message_to_input(message))
        return items

    def _message_to_input(self, message: ChatMessage) -> list[dict[str, Any]]:
        if message.role == "tool":
            return [{"type": "function_call_output", "call_id": message.tool_call_id, "output": message.content}]
        if message.requested_tool_calls:
            return [
                {
                    "type": "function_call",
                    "call_id": tool_call.id,
                    "name": tool_call.name,
                    "arguments": json.dumps(tool_call.arguments),
                }
                for tool_call in message.requested_tool_calls
            ]
        return [{"role": message.role, "content": [{"type": "input_text", "text": message.content}]}]

    def _parse_arguments(self, raw_arguments: str | dict[str, Any]) -> dict[str, Any]:
        if isinstance(raw_arguments, dict):
            return raw_arguments
        try:
            parsed = json.loads(raw_arguments)
        except json.JSONDecodeError:
            return {"raw": raw_arguments}
        return parsed if isinstance(parsed, dict) else {"value": parsed}


def get_provider_adapter(protocol: str) -> ProviderAdapter:
    if protocol == "responses":
        return OpenAIResponsesAdapter()
    return OpenAIChatAdapter()
