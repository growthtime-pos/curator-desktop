from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.models import ChatMessage, ProviderRequest, SkillToolDefinition, ToolParameterSchema
from src.providers import OpenAIChatAdapter, OpenAIResponsesAdapter


class ProviderAdapterTests(unittest.TestCase):
    def test_chat_adapter_serializes_messages_and_tools(self) -> None:
        adapter = OpenAIChatAdapter()
        provider_request = ProviderRequest(
            messages=[
                ChatMessage(id="u1", role="user", content="hello", createdAt="2026-03-20T00:00:00Z"),
                ChatMessage(
                    id="t1",
                    role="tool",
                    content="result",
                    createdAt="2026-03-20T00:00:01Z",
                    toolName="lookup",
                    toolCallId="call_1",
                ),
            ],
            systemInstructions=["You are helpful."],
            toolDefinitions=[
                SkillToolDefinition(
                    name="lookup",
                    description="Look something up.",
                    inputSchema=ToolParameterSchema(),
                )
            ],
        )

        payload = adapter._serialize_messages(provider_request)
        self.assertEqual(payload[0]["role"], "system")
        self.assertEqual(payload[1]["role"], "user")
        self.assertEqual(payload[2]["tool_call_id"], "call_1")

    def test_responses_adapter_serializes_tool_outputs(self) -> None:
        adapter = OpenAIResponsesAdapter()
        provider_request = ProviderRequest(
            messages=[
                ChatMessage(id="u1", role="user", content="hello", createdAt="2026-03-20T00:00:00Z"),
                ChatMessage(
                    id="t1",
                    role="tool",
                    content="result",
                    createdAt="2026-03-20T00:00:01Z",
                    toolName="lookup",
                    toolCallId="call_1",
                ),
            ],
            systemInstructions=["You are helpful."],
        )

        payload = adapter._serialize_input(provider_request)
        self.assertEqual(payload[0]["role"], "system")
        self.assertEqual(payload[1]["role"], "user")
        self.assertEqual(payload[2]["type"], "function_call_output")


if __name__ == "__main__":
    unittest.main()
