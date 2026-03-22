from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.confluence import AtlassianCredentials, ConfluenceClient, get_page, list_spaces, search_pages

app = FastAPI(title="Curator Backend", version="0.2.0")


class ConfluenceCredentialsRequest(BaseModel):
    base_url: str = Field(..., description="Confluence base URL")
    username: str = Field(..., description="Atlassian ID or email")
    password: str = Field(..., description="Atlassian password or API token")


class SearchRequest(ConfluenceCredentialsRequest):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=25, ge=1, le=100)


class SpaceListRequest(ConfluenceCredentialsRequest):
    limit: int = Field(default=25, ge=1, le=100)


class PageRequest(ConfluenceCredentialsRequest):
    page_id: str = Field(..., min_length=1)


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
    creds = AtlassianCredentials(
        base_url=payload.base_url,
        username=payload.username,
        password=payload.password,
    )
    try:
        spaces = list_spaces(ConfluenceClient(creds), payload.limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"count": len(spaces), "results": spaces}


@app.post("/confluence/search")
def confluence_search(payload: SearchRequest) -> dict[str, object]:
    creds = AtlassianCredentials(
        base_url=payload.base_url,
        username=payload.username,
        password=payload.password,
    )
    try:
        pages = search_pages(ConfluenceClient(creds), payload.query, payload.limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"count": len(pages), "results": pages}


@app.post("/confluence/page")
def confluence_page(payload: PageRequest) -> dict[str, object]:
    creds = AtlassianCredentials(
        base_url=payload.base_url,
        username=payload.username,
        password=payload.password,
    )
    try:
        page = get_page(ConfluenceClient(creds), payload.page_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return page
