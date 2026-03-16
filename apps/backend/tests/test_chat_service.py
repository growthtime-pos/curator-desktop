import unittest

from src.config import BackendConfig
from src.schemas import ChatRequest
from src.services.chat_service import ChatService


class FakeConfluenceClient:
    def search_pages(self, query: str, space_key: str, limit: int):
        return [
            type("R", (), {"page_id": "123", "title": "Release Playbook", "webui_path": "/spaces/ENG/pages/123", "excerpt": "release excerpt"})(),
        ]

    def fetch_page_storage(self, page_id: str) -> str:
        return "This is a confluence page body for release guidance and rollout checklist."


class ChatServiceTest(unittest.TestCase):
    def test_build_response_uses_confluence_documents(self):
        config = BackendConfig(
            confluence_base_url="https://conf.example",
            confluence_username="bot",
            confluence_password="pw",
            confluence_space_key="ENG",
        )
        service = ChatService(config=config, confluence_client=FakeConfluenceClient())

        result = service.build_response(ChatRequest(message="릴리스 노트 작성", top_k=1))

        self.assertTrue(result.conversation_id.startswith("conv-"))
        self.assertEqual(len(result.retrieved_documents), 1)
        self.assertIn("Confluence 검색/요약 결과", result.answer)
        self.assertEqual(result.sources[0].title, "Release Playbook")

    def test_build_response_fallback_when_config_missing(self):
        config = BackendConfig(
            confluence_base_url="",
            confluence_username="",
            confluence_password="",
            confluence_space_key="ENG",
        )
        service = ChatService(config=config)

        result = service.build_response(ChatRequest(message="테스트"))

        self.assertEqual(result.retrieved_documents[0].id, "local-fallback")

    def test_build_response_uses_request_scoped_confluence_override(self):
        config = BackendConfig(
            confluence_base_url="",
            confluence_username="",
            confluence_password="",
            confluence_space_key="ENG",
        )
        service = ChatService(config=config, confluence_client=FakeConfluenceClient())

        payload = ChatRequest(
            message="테스트",
            confluence={
                "base_url": "https://temp-confluence.example",
                "username": "id",
                "password": "pw",
                "space_key": "DOC",
            },
        )
        # inject fake client path by replacing resolver output behavior
        service._build_client_from_request = lambda *_args, **_kwargs: (FakeConfluenceClient(), "DOC")  # type: ignore[method-assign]

        result = service.build_response(payload)
        self.assertEqual(result.retrieved_documents[0].url, "https://temp-confluence.example/spaces/ENG/pages/123")


if __name__ == "__main__":
    unittest.main()
