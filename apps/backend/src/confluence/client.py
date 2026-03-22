from __future__ import annotations

from typing import Any

import httpx

from .config import AtlassianCredentials, normalize_confluence_base_url


class ConfluenceClient:
    def __init__(self, credentials: AtlassianCredentials, timeout: float = 20.0):
        self.credentials = credentials
        self.timeout = timeout
        self._normalized_base_url = normalize_confluence_base_url(credentials.base_url)

    @property
    def api_base_url(self) -> str:
        return f"{self._normalized_base_url}/rest/api"

    def _build_headers(self) -> dict[str, str]:
        return {"Accept": "application/json"}

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.api_base_url}/{path.lstrip('/')}"
        response = httpx.get(
            url,
            params=params,
            headers=self._build_headers(),
            auth=(self.credentials.username, self.credentials.auth_secret),
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()
