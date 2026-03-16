import base64
import json
from dataclasses import dataclass
from html import unescape
from re import sub
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class ConfluenceClientError(Exception):
    pass


@dataclass(frozen=True)
class ConfluenceSearchResult:
    page_id: str
    title: str
    webui_path: str
    excerpt: str


class ConfluenceClient:
    """Read-only Confluence client. Only GET endpoints are used."""

    def __init__(self, base_url: str, username: str, password: str, timeout_s: int = 15) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout_s = timeout_s

    def _auth_header(self) -> str:
        raw = f"{self.username}:{self.password}".encode("utf-8")
        return f"Basic {base64.b64encode(raw).decode('utf-8')}"

    def _request_json(self, url: str) -> dict:
        req = Request(
            url,
            headers={
                "Accept": "application/json",
                "Authorization": self._auth_header(),
            },
            method="GET",
        )

        try:
            with urlopen(req, timeout=self.timeout_s) as res:
                payload = res.read().decode("utf-8")
                return json.loads(payload)
        except HTTPError as exc:
            raise ConfluenceClientError(f"Confluence HTTP error: {exc.code}") from exc
        except URLError as exc:
            raise ConfluenceClientError(f"Confluence connection error: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise ConfluenceClientError("Invalid JSON from Confluence API") from exc

    def search_pages(self, query: str, space_key: str, limit: int) -> list[ConfluenceSearchResult]:
        cql = quote(f'space="{space_key}" AND type=page AND text ~ "{query}"')
        url = f"{self.base_url}/wiki/rest/api/search?cql={cql}&limit={limit}"
        data = self._request_json(url)

        results: list[ConfluenceSearchResult] = []
        for item in data.get("results", []):
            content = item.get("content", {})
            links = content.get("_links", {})
            page_id = str(content.get("id", ""))
            title = content.get("title", "Untitled")
            webui_path = links.get("webui", "")
            excerpt = self._clean_text(item.get("excerpt", ""))
            if page_id and webui_path:
                results.append(
                    ConfluenceSearchResult(
                        page_id=page_id,
                        title=title,
                        webui_path=webui_path,
                        excerpt=excerpt,
                    )
                )

        return results

    def fetch_page_storage(self, page_id: str) -> str:
        url = f"{self.base_url}/wiki/rest/api/content/{page_id}?expand=body.storage"
        data = self._request_json(url)
        html_value = data.get("body", {}).get("storage", {}).get("value", "")
        return self._clean_text(html_value)

    @staticmethod
    def _clean_text(raw: str) -> str:
        stripped = sub(r"<[^>]+>", " ", raw)
        compact = sub(r"\s+", " ", unescape(stripped)).strip()
        return compact
