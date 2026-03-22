from __future__ import annotations

from typing import Any

from .client import ConfluenceClient


def list_spaces(client: ConfluenceClient, limit: int = 25) -> list[dict[str, Any]]:
    payload = client.get("space", params={"limit": limit})
    return payload.get("results", [])


def search_pages(client: ConfluenceClient, query: str, limit: int = 25) -> list[dict[str, Any]]:
    cql = f'type = "page" AND text ~ "{query}"'
    payload = client.get("search", params={"cql": cql, "limit": limit})
    return payload.get("results", [])


def get_page(client: ConfluenceClient, page_id: str) -> dict[str, Any]:
    return client.get(f"content/{page_id}", params={"expand": "body.storage,version,space"})
