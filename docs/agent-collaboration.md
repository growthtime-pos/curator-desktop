# Agent Collaboration Documentation

이 문서는 **Agent 간 개발 실행**을 위한 운영 문서다.
사람 대상 설명은 최소화하고, Agent가 다음 작업을 이어받기 쉽게 상태/계약/체크리스트 중심으로 유지한다.

## 목적
- Agent 간 역할 충돌 방지
- 변경 시 계약(타입/API/설정) 동기화
- 다음 작업 Agent가 즉시 실행 가능한 인수인계 제공

## 필수 기록 항목
1. 작업 컨텍스트
   - 목표
   - 변경 범위(디렉터리/모듈)
2. 계약 변경
   - API 스펙 변경
   - `packages/shared` 타입/스키마 변경
   - 호환성 영향
3. 검증 결과
   - 실행한 테스트/검증 명령
   - 실패/보류 항목과 원인
4. 후속 작업
   - 다음 Agent 액션 아이템
   - 블로커/의존성

## 인수인계 템플릿
```md
## Handoff
- Goal:
- Changed:
- Contracts Updated:
- Validation:
- Next Actions:
- Blockers:
```

## Handoff
- Goal: 백엔드 추가 구현 착수를 위해 최소 API 계약(chat/sync)을 먼저 확정하고 데스크톱 연동 가능한 상태를 만든다.
- Changed:
  - `apps/backend/src/main.py`에 chat/sync 엔드포인트 추가
  - `apps/backend/src/schemas.py`에 요청/응답 모델 추가
  - `apps/backend/src/services/chat_service.py`에 응답 생성 서비스 추가
  - `apps/backend/README.md`에 실행/호출 예시 및 향후 계획 문서화
- Contracts Updated:
  - `POST /v1/chat` request: `{ message: string, conversation_id?: string }`
  - `POST /v1/chat` response: `{ conversation_id: string, answer: string, sources: {title,url}[] }`
  - `GET /v1/sync/status` response: `{ backend: string, last_synced_at: string | null }`
- Validation:
  - `python -m compileall apps/backend/src`
  - FastAPI route 목록 점검 스크립트로 신규 경로 확인
- Next Actions:
  - 데스크톱 ChatPage에서 `/v1/chat` 실호출 연결
  - Settings API 값 기반 인증 헤더 주입 설계
  - Confluence 연동 어댑터 추가 및 오류/재시도 정책 정의
- Blockers:
  - 실제 Confluence 접속 정보 및 인증 정책 미정

## Handoff
- Goal: Confluence API 실연동과 검색/요약 파이프라인 1차 구현 + 테스트 체계 추가
- Changed:
  - `apps/backend/src/config.py` 환경 변수 기반 설정 로더 추가
  - `apps/backend/src/services/confluence_client.py` Confluence REST API 클라이언트 추가
  - `apps/backend/src/services/chat_service.py`를 실검색/본문조회/요약 파이프라인으로 확장
  - `apps/backend/tests/test_chat_service.py`, `apps/backend/tests/test_api.py` 단위 테스트 추가
- Contracts Updated:
  - `POST /v1/chat` request에 `space_key`, `top_k` 필드 추가
  - `POST /v1/chat` response에 `retrieved_documents` 추가
- Validation:
  - `python -m compileall apps/backend/src`
  - `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`
- Next Actions:
  - 실제 Atlassian Cloud/Server 응답 스키마 차이를 흡수하는 어댑터 분리
  - 검색 결과 정렬 및 요약 품질 개선
- Blockers:
  - 운영 Confluence 인증 정보 미제공으로 실환경 호출 검증 미실시

## Handoff
- Goal: 백엔드 테스트를 GitHub Actions에서 자동 실행 가능하도록 CI 파이프라인 추가
- Changed:
  - `.github/workflows/backend-tests.yml` 신규 추가
  - backend 관련 변경 시 compile check + unittest를 자동 수행하도록 구성
- Contracts Updated:
  - API 계약 변경 없음
- Validation:
  - `python -m compileall apps/backend/src`
  - `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`
- Next Actions:
  - 필요 시 lint/type-check 단계(ruff/mypy) 확장
  - Desktop/Backend 통합 smoke test 워크플로우 추가 검토
- Blockers:
  - 없음
