from __future__ import annotations

import os

import pytest

from src.confluence import AtlassianCredentials, ConfluenceClient, list_spaces
from src.confluence.config import normalize_confluence_base_url


def test_normalize_confluence_base_url_adds_wiki_for_cloud() -> None:
    assert normalize_confluence_base_url("https://example.atlassian.net") == "https://example.atlassian.net/wiki"


def test_normalize_confluence_base_url_keeps_existing_wiki() -> None:
    assert (
        normalize_confluence_base_url("https://example.atlassian.net/wiki/")
        == "https://example.atlassian.net/wiki"
    )


def test_credentials_uses_token_before_password() -> None:
    credentials = AtlassianCredentials(
        base_url="https://example.atlassian.net/wiki",
        username="user@example.com",
        token="preferred-token",
        password="fallback-password",
    )

    assert credentials.auth_secret == "preferred-token"


@pytest.mark.integration
def test_list_spaces_with_real_atlassian_env() -> None:
    if os.environ.get("RUN_CONFLUENCE_INTEGRATION") != "1":
        pytest.skip("Set RUN_CONFLUENCE_INTEGRATION=1 to execute live Confluence integration test")

    url = os.environ.get("ATLASSIAN_URL")
    username = os.environ.get("ATLASSIAN_ID")
    token = os.environ.get("ATLASSIAN_TOKEN")
    password = os.environ.get("ATLASSIAN_PW")

    if not (url and username and (token or password)):
        pytest.skip("ATLASSIAN_URL, ATLASSIAN_ID and ATLASSIAN_TOKEN(or ATLASSIAN_PW) are required")

    credentials = AtlassianCredentials(
        base_url=url,
        username=username,
        token=token or "",
        password=password or "",
    )
    client = ConfluenceClient(credentials)

    spaces = list_spaces(client, limit=1)

    assert isinstance(spaces, list)
