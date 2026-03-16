import unittest

import src.main as backend_main
from src.schemas import ChatRequest, ChatResponse, ConfluenceDocument, SourceDocument


class StubChatService:
    def build_response(self, payload):
        return ChatResponse(
            conversation_id=payload.conversation_id or "conv-test",
            answer="stub answer",
            sources=[SourceDocument(title="Doc", url="https://example.local/doc")],
            retrieved_documents=[
                ConfluenceDocument(
                    id="1",
                    title="Doc",
                    url="https://example.local/doc",
                    excerpt="excerpt",
                )
            ],
        )


class ApiHandlerTest(unittest.TestCase):
    def setUp(self):
        self.original_chat_service = backend_main.chat_service
        backend_main.chat_service = StubChatService()

    def tearDown(self):
        backend_main.chat_service = self.original_chat_service

    def test_health_handler(self):
        response = backend_main.health()
        self.assertEqual(response.status, "ok")

    def test_sync_status_handler(self):
        response = backend_main.sync_status()
        self.assertEqual(response.backend, "connected")
        self.assertIsNotNone(response.last_synced_at)

    def test_chat_handler(self):
        response = backend_main.chat(ChatRequest(message="hello"))
        self.assertEqual(response.answer, "stub answer")
        self.assertEqual(response.sources[0].title, "Doc")


if __name__ == "__main__":
    unittest.main()
