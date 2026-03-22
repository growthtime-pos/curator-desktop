from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.confluence import AtlassianCredentials, ConfluenceClient, get_page, list_spaces, search_pages

app = FastAPI(title="Curator Backend", version="0.2.1")


class ConfluenceCredentialsRequest(BaseModel):
    base_url: str = Field(..., description="Confluence base URL")
    username: str = Field(..., description="Atlassian ID or email")
    token: str = Field(default="", description="Confluence API token (preferred)")
    password: str = Field(default="", description="Atlassian password (fallback)")


class SearchRequest(ConfluenceCredentialsRequest):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=25, ge=1, le=100)


class SpaceListRequest(ConfluenceCredentialsRequest):
    limit: int = Field(default=25, ge=1, le=100)


class PageRequest(ConfluenceCredentialsRequest):
    page_id: str = Field(..., min_length=1)


def _build_credentials(payload: ConfluenceCredentialsRequest) -> AtlassianCredentials:
    creds = AtlassianCredentials(
        base_url=payload.base_url,
        username=payload.username,
        token=payload.token,
        password=payload.password,
    )
    creds.validate()
    return creds


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/confluence/health")
def confluence_health_from_env() -> dict[str, str]:
    creds = AtlassianCredentials.from_env()
    try:
        creds.validate()
        client = ConfluenceClient(creds)
        client.get("space", params={"limit": 1})
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/confluence/spaces")
def confluence_spaces(payload: SpaceListRequest) -> dict[str, object]:
    try:
        spaces = list_spaces(ConfluenceClient(_build_credentials(payload)), payload.limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"count": len(spaces), "results": spaces}


@app.post("/confluence/search")
def confluence_search(payload: SearchRequest) -> dict[str, object]:
    try:
        pages = search_pages(ConfluenceClient(_build_credentials(payload)), payload.query, payload.limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"count": len(pages), "results": pages}


@app.post("/confluence/page")
def confluence_page(payload: PageRequest) -> dict[str, object]:
    try:
        page = get_page(ConfluenceClient(_build_credentials(payload)), payload.page_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return page
