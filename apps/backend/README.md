# Curator Backend

FastAPI 기반 백엔드 애플리케이션입니다.

## Confluence 수집 API

Confluence 데이터를 URL/ID/PW 기반으로 수집할 수 있도록 엔드포인트를 제공합니다.

### 엔드포인트

- `GET /confluence/health`
  - 환경변수 `ATLASSIAN_URL`, `ATLASSIAN_ID`, `ATLASSIAN_PW`를 사용해 연결 확인
- `POST /confluence/spaces`
  - Space 목록 조회
- `POST /confluence/search`
  - 텍스트 기반 페이지 검색
- `POST /confluence/page`
  - 페이지 ID로 상세 본문 조회

### 스킬(워크플로) 단위 분리

`src/confluence/actions.py`에 동작별 함수로 분리되어 있어, 향후 스킬에서 그대로 재사용할 수 있습니다.

- `list_spaces`
- `search_pages`
- `get_page`

### 로컬 실행

```bash
cd apps/backend
uv sync
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 테스트 실행

```bash
cd apps/backend
uv run pytest -q
```

실제 Atlassian 연동 통합 테스트를 실행하려면 환경변수를 설정하세요.

```bash
export ATLASSIAN_URL="https://your-domain.atlassian.net/wiki"
export ATLASSIAN_ID="your-id"
export ATLASSIAN_PW="your-password-or-api-token"
uv run pytest -q -m integration
```
