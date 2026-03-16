from datetime import datetime, UTC
from textwrap import shorten
from uuid import uuid4

from ..config import BackendConfig, load_config
from ..schemas import ChatRequest, ChatResponse, ConfluenceDocument, SourceDocument
from .confluence_client import ConfluenceClient, ConfluenceClientError


class ChatService:
    def __init__(self, config: BackendConfig | None = None, confluence_client: ConfluenceClient | None = None) -> None:
        self.config = config or load_config()
        self.confluence_client = confluence_client or self._build_client_from_config(self.config)

    @staticmethod
    def _build_client_from_config(config: BackendConfig) -> ConfluenceClient:
        return ConfluenceClient(
            base_url=config.confluence_base_url,
            username=config.confluence_username,
            password=config.confluence_password,
            mode=config.confluence_version if config.confluence_version in {"auto", "cloud", "server"} else "auto",
        )

    @staticmethod
    def _build_client_from_request(payload: ChatRequest, default_space_key: str) -> tuple[ConfluenceClient, str] | None:
        if not payload.confluence:
            return None

        client = ConfluenceClient(
            base_url=payload.confluence.base_url,
            username=payload.confluence.username,
            password=payload.confluence.password,
            mode=payload.confluence.version,
        )
        space_key = payload.confluence.space_key or payload.space_key or default_space_key
        return client, space_key

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
        request_client_override = self._build_client_from_request(payload, self.config.confluence_space_key)

        if request_client_override:
            confluence_client, space_key = request_client_override
            base_url = payload.confluence.base_url.rstrip("/")
        elif self.config.is_confluence_configured:
            confluence_client = self.confluence_client
            space_key = payload.space_key or self.config.confluence_space_key
            base_url = self.config.confluence_base_url
        else:
            return [
                ConfluenceDocument(
                    id="local-fallback",
                    title="Confluence not configured",
                    url="internal://curator/backend/configuration",
                    excerpt=(
                        "요청 본문에 confluence.base_url/username/password/version을 전달하거나 "
                        "환경 변수(CONFLUENCE_BASE_URL/USERNAME/PASSWORD/VERSION)를 설정하세요."
                    ),
                )
            ]

        try:
            search_results = confluence_client.search_pages(payload.message, space_key=space_key, limit=payload.top_k)
            documents: list[ConfluenceDocument] = []
            for result in search_results:
                body_text = confluence_client.fetch_page_storage(result.page_id)
                excerpt = shorten(body_text or result.excerpt, width=280, placeholder="...")
                documents.append(
                    ConfluenceDocument(
                        id=result.page_id,
                        title=result.title,
                        url=f"{base_url}{result.webui_path}",
                        excerpt=excerpt,
                    )
                )
            return documents or [
                ConfluenceDocument(
                    id="search-empty",
                    title="검색 결과 없음",
                    url=f"{base_url}",
                    excerpt=f'질의어 "{payload.message}"에 해당하는 Confluence 문서를 찾지 못했습니다.',
                )
            ]
        except ConfluenceClientError as exc:
            return [
                ConfluenceDocument(
                    id="search-error",
                    title="Confluence 검색 실패",
                    url=f"{base_url}",
                    excerpt=f"Confluence API 호출 중 오류가 발생했습니다: {exc}",
                )
            ]

    @staticmethod
    def _summarize(user_message: str, documents: list[ConfluenceDocument]) -> str:
        top_docs = documents[:3]
        doc_lines = "\n".join(f"- {doc.title}: {doc.excerpt}" for doc in top_docs)
        return (
            f'요청: "{user_message}"\n\n'
            "Confluence 검색/요약 결과(read-only):\n"
            f"{doc_lines}\n\n"
            f"생성 시각(UTC): {datetime.now(UTC).isoformat()}"
        )
