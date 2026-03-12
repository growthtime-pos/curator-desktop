# Curator Backend

FastAPI 기반 백엔드 애플리케이션입니다.

## 현재 구현 상태

- `GET /health`: 서비스 헬스체크
- `GET /v1/sync/status`: 동기화 상태 조회
- `POST /v1/chat`: Confluence 문서 검색 + 본문 추출 + 요약 텍스트 생성

## Confluence 연동 환경 변수

- `CONFLUENCE_BASE_URL` (예: `https://your-domain.atlassian.net`)
- `CONFLUENCE_EMAIL`
- `CONFLUENCE_API_TOKEN`
- `CONFLUENCE_SPACE_KEY` (기본값: `ENG`)

환경 변수가 없으면 `/v1/chat`은 fallback 문서를 반환합니다.

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
  -d '{"message":"릴리스 노트 초안 만들어줘", "top_k": 3}'
```

## 테스트

```bash
cd apps/backend
python -m unittest discover -s tests -p 'test_*.py'
```

## 다음 구현 예정

- 검색 결과 re-ranking(문서 최신성/키워드 점수)
- 요약 품질 개선(섹션 기반 요약, 중복 제거)
- 데스크톱 설정(`apiBaseUrl`, `apiKey`, `spaceKey`) 기반 인증/권한 검증
