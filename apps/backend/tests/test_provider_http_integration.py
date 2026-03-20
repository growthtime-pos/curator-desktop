from __future__ import annotations

import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.chat_service import ChatDependencies, ChatService, SessionStore
from src.models import CreateSessionRequest, ProviderConfig, SendMessageRequest, SessionSkillUpdateRequest
from src.skills import SkillRegistry
from src.tool_runner import ToolRunner


class _MockProviderHandler(BaseHTTPRequestHandler):
    requests: list[tuple[str, dict]] = []

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.__class__.requests.append((self.path, payload))

        if self.path == "/v1/chat/completions":
            body = self._handle_chat(payload)
        elif self.path == "/v1/responses":
            body = self._handle_responses(payload)
        else:
            self.send_response(404)
            self.end_headers()
            return

        encoded = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return

    def _handle_chat(self, payload: dict) -> dict:
        messages = payload.get("messages") or []
        has_tool_output = any(message.get("role") == "tool" for message in messages)
        if not has_tool_output:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call_1",
                                    "type": "function",
                                    "function": {
                                        "name": "list_workspace_overview",
                                        "arguments": "{}",
                                    },
                                }
                            ],
                        }
                    }
                ]
            }

        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Remote chat provider completed with tool output.",
                    }
                }
            ]
        }

    def _handle_responses(self, payload: dict) -> dict:
        items = payload.get("input") or []
        has_tool_output = any(item.get("type") == "function_call_output" for item in items)
        if not has_tool_output:
            return {
                "output": [
                    {
                        "type": "function_call",
                        "call_id": "call_1",
                        "name": "list_workspace_overview",
                        "arguments": "{}",
                    }
                ]
            }

        return {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "Remote responses provider completed with tool output.",
                        }
                    ],
                }
            ]
        }


class ProviderHttpIntegrationTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _MockProviderHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}/v1"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def setUp(self) -> None:
        _MockProviderHandler.requests.clear()
        self.service = ChatService(
            dependencies=ChatDependencies(skills=SkillRegistry(), tools=ToolRunner()),
            store=SessionStore(),
        )

    async def test_chat_protocol_round_trips_remote_tool_call(self) -> None:
        provider_config = ProviderConfig(
            apiBaseUrl=self.base_url,
            apiKey="test-key",
            model="mock-chat-model",
            providerProtocol="chat",
        )
        session = self.service.create_session(CreateSessionRequest(providerConfig=provider_config))
        self.service.activate_skill(
            session.session_id,
            SessionSkillUpdateRequest(skillId="workspace-toolkit"),
        )

        updated = await self.service.send_message(
            session.session_id,
            SendMessageRequest(content="Inspect the workspace remotely.", providerConfig=provider_config),
        )

        assert updated is not None
        assistant = updated.messages[-1]
        self.assertEqual(assistant.content, "Remote chat provider completed with tool output.")
        self.assertIn("workspace-toolkit", assistant.applied_skill_ids)
        self.assertIn("Tool executed: list_workspace_overview", assistant.trace)
        self.assertEqual([path for path, _ in _MockProviderHandler.requests], ["/v1/chat/completions", "/v1/chat/completions"])
        first_payload = _MockProviderHandler.requests[0][1]
        self.assertEqual(first_payload["tools"][0]["function"]["name"], "list_workspace_overview")
        second_payload = _MockProviderHandler.requests[1][1]
        self.assertTrue(any(message.get("role") == "tool" for message in second_payload["messages"]))

    async def test_responses_protocol_round_trips_remote_tool_call(self) -> None:
        provider_config = ProviderConfig(
            apiBaseUrl=self.base_url,
            apiKey="test-key",
            model="mock-responses-model",
            providerProtocol="responses",
        )
        session = self.service.create_session(CreateSessionRequest(providerConfig=provider_config))
        self.service.activate_skill(
            session.session_id,
            SessionSkillUpdateRequest(skillId="workspace-toolkit"),
        )

        updated = await self.service.send_message(
            session.session_id,
            SendMessageRequest(content="Inspect the workspace through responses API.", providerConfig=provider_config),
        )

        assert updated is not None
        assistant = updated.messages[-1]
        self.assertEqual(assistant.content, "Remote responses provider completed with tool output.")
        self.assertIn("workspace-toolkit", assistant.applied_skill_ids)
        self.assertIn("Tool executed: list_workspace_overview", assistant.trace)
        self.assertEqual([path for path, _ in _MockProviderHandler.requests], ["/v1/responses", "/v1/responses"])
        first_payload = _MockProviderHandler.requests[0][1]
        self.assertEqual(first_payload["tools"][0]["name"], "list_workspace_overview")
        second_payload = _MockProviderHandler.requests[1][1]
        self.assertTrue(any(item.get("type") == "function_call_output" for item in second_payload["input"]))


if __name__ == "__main__":
    unittest.main()
