from datetime import datetime, UTC
from textwrap import shorten
from uuid import uuid4

from ..config import BackendConfig, load_config
from ..schemas import ChatRequest, ChatResponse, ConfluenceDocument, SourceDocument
from .confluence_client import ConfluenceClient, ConfluenceClientError


class ChatService:
    def __init__(self, config: BackendConfig | None = None, confluence_client: ConfluenceClient | None = None) -> None:
        self.config = config or load_config()
        self.confluence_client = confluence_client or ConfluenceClient(
            base_url=self.config.confluence_base_url,
            email=self.config.confluence_email,
            api_token=self.config.confluence_api_token,
        )

    def build_response(self, payload: ChatRequest) -> ChatResponse:
        conversation_id = payload.conversation_id or f"conv-{uuid4().hex[:8]}"
        documents = self._retrieve_documents(payload)

        answer = self._summarize(payload.message, documents)
        sources = [SourceDocument(title=doc.title, url=doc.url) for doc in documents]

        return ChatResponse(
            conversation_id=conversation_id,
            answer=answer,
            sources=sources,
            retrieved_documents=documents,
        )

    def _retrieve_documents(self, payload: ChatRequest) -> list[ConfluenceDocument]:
        if not self.config.is_confluence_configured:
            return [
                ConfluenceDocument(
                    id="local-fallback",
                    title="Confluence not configured",
                    url="internal://curator/backend/configuration",
                    excerpt="CONFLUENCE_BASE_URL/EMAIL/API_TOKEN 환경 변수를 설정하면 실검색이 활성화됩니다.",
                )
            ]

        space_key = payload.space_key or self.config.confluence_space_key
        try:
            search_results = self.confluence_client.search_pages(payload.message, space_key=space_key, limit=payload.top_k)
            documents: list[ConfluenceDocument] = []
            for result in search_results:
                body_text = self.confluence_client.fetch_page_storage(result.page_id)
                excerpt = shorten(body_text or result.excerpt, width=280, placeholder="...")
                documents.append(
                    ConfluenceDocument(
                        id=result.page_id,
                        title=result.title,
                        url=f"{self.config.confluence_base_url}{result.webui_path}",
                        excerpt=excerpt,
                    )
                )
            return documents or [
                ConfluenceDocument(
                    id="search-empty",
                    title="검색 결과 없음",
                    url=f"{self.config.confluence_base_url}/wiki",
                    excerpt=f'질의어 "{payload.message}"에 해당하는 Confluence 문서를 찾지 못했습니다.',
                )
            ]
        except ConfluenceClientError as exc:
            return [
                ConfluenceDocument(
                    id="search-error",
                    title="Confluence 검색 실패",
                    url=f"{self.config.confluence_base_url}/wiki",
                    excerpt=f"Confluence API 호출 중 오류가 발생했습니다: {exc}",
                )
            ]

    @staticmethod
    def _summarize(user_message: str, documents: list[ConfluenceDocument]) -> str:
        top_docs = documents[:3]
        doc_lines = "\n".join(f"- {doc.title}: {doc.excerpt}" for doc in top_docs)
        return (
            f'요청: "{user_message}"\n\n'
            "Confluence 검색/요약 결과:\n"
            f"{doc_lines}\n\n"
            f"생성 시각(UTC): {datetime.now(UTC).isoformat()}"
        )
