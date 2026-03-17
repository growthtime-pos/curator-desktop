# Curator Backend

FastAPI 기반 백엔드 애플리케이션입니다.

## 현재 구현 상태

- `GET /health`: 서비스 헬스체크
- `GET /v1/sync/status`: 동기화 상태 조회
- `POST /v1/chat`: Confluence 문서 검색 + 본문 추출 + 요약 텍스트 생성
- Confluence 연동은 **read-only(GET only)** 로만 동작합니다. (쓰기 API 미사용)

## Confluence 인증/연결 방식

### 1) 기본(환경 변수)
- `CONFLUENCE_BASE_URL`
- `CONFLUENCE_USERNAME`
- `CONFLUENCE_PASSWORD`
- `CONFLUENCE_SPACE_KEY` (기본값: `ENG`)
- `CONFLUENCE_VERSION` (`auto` | `cloud` | `server`, 기본값: `auto`)

### 2) 요청 단위 override (테스트용 주소 즉시 적용)
`POST /v1/chat` 바디에 `confluence` 객체를 넣으면 해당 요청에서만 지정 주소/계정으로 검색합니다.

- `version` 지정 시 해당 버전 경로로 동작
- `version: "auto"` 시 `/wiki/rest/api/...`(Cloud) 먼저 시도 후 `/rest/api/...`(Server/DC) 감지

```json
{
  "message": "릴리스 노트 초안 만들어줘",
  "top_k": 3,
  "confluence": {
    "base_url": "https://test-confluence.example",
    "username": "my-id",
    "password": "my-password",
    "space_key": "ENG",
    "version": "auto"
  }
}
```

## 로컬 실행

```bash
uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

## API 예시

```bash
curl -s http://localhost:8000/health

curl -s http://localhost:8000/v1/sync/status

curl -s -X POST http://localhost:8000/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message":"릴리스 노트 초안 만들어줘",
    "top_k": 3,
    "confluence": {
      "base_url": "https://test-confluence.example",
      "username": "my-id",
      "password": "my-password",
      "space_key": "ENG",
      "version": "server"
    }
  }'
```

## 테스트

```bash
cd apps/backend
python -m unittest discover -s tests -p 'test_*.py'
```

## 다음 구현 예정

- 검색 결과 re-ranking(문서 최신성/키워드 점수)
- 요약 품질 개선(섹션 기반 요약, 중복 제거)
- 데스크톱 설정(`apiBaseUrl`, `id/pw`, `spaceKey`, `version`) 기반 연동 고도화
