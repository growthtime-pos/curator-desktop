# Human-facing Development Notes (Release Notes)

이 문서는 사람이 개발 과정을 확인할 수 있도록, 변경 사항을 릴리스 노트 형식으로 관리한다.
세부 구현 맥락보다 결과 중심으로 작성한다.

## 작성 규칙
- 버전 또는 날짜 단위로 섹션을 구분한다.
- 각 섹션은 최소 아래 항목을 포함한다.
  - Added
  - Changed
  - Fixed
  - Validation

## Template
```md
## [YYYY-MM-DD] Release Note
### Added
- 

### Changed
- 

### Fixed
- 

### Validation
- ✅ command
- ⚠️ command (환경 제약)
- ❌ command (실패 원인)
```

## Current

## [2026-03-08] Repository Foundation Update
### Added
- 모노레포 기본 구조(`apps/desktop`, `apps/backend`, `packages/shared`, `docs`)를 추가했다.
- FastAPI `/health` 엔드포인트를 포함한 백엔드 엔트리를 추가했다.
- Windows 우선 Electron Builder 설정을 추가했다.

### Changed
- Agent 협업 전용 문서와 사람 검토용 문서를 분리했다.
- Agent 역할 문서에 아키텍처 정합성 검토 및 릴리스 노트 작성 책임을 명시했다.

### Fixed
- 없음.

### Validation
- ✅ `python -m compileall apps/backend/src/main.py`
- ✅ `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('apps/desktop/package.json','utf8')); console.log('json ok')"`

## [2026-03-12] Backend API Bootstrap
### Added
- 백엔드에 `POST /v1/chat`, `GET /v1/sync/status` 엔드포인트를 추가했다.
- 채팅 요청/응답 및 동기화 상태를 위한 스키마 모델을 추가했다.
- 백엔드 API 사용 예시와 다음 구현 예정 항목을 `apps/backend/README.md`에 문서화했다.

### Changed
- FastAPI 애플리케이션 버전을 `0.2.0`으로 올리고 헬스체크 응답을 명시적 모델 기반으로 정리했다.

### Fixed
- 없음.

### Validation
- ✅ `python -m compileall apps/backend/src`
- ✅ `python - <<'PY'
from apps.backend.src.main import app
paths = sorted(route.path for route in app.routes)
print(paths)
PY`

## [2026-03-12] Confluence Search/Summary Pipeline + Tests
### Added
- Confluence 환경 변수 로더 및 REST API 클라이언트를 추가했다.
- `/v1/chat`에 Confluence 검색/본문 조회/요약 파이프라인을 연결했다.
- 백엔드 API/서비스 단위 테스트(`unittest`)를 추가했다.

### Changed
- `POST /v1/chat` 요청 스키마에 `space_key`, `top_k`를 추가하고, 응답에 `retrieved_documents`를 포함하도록 확장했다.
- 앱 버전을 `0.3.0`으로 업데이트했다.

### Fixed
- Confluence 미설정 환경에서도 fallback 응답을 반환하도록 처리해 개발 환경 안정성을 높였다.

### Validation
- ✅ `python -m compileall apps/backend/src`
- ✅ `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`

## [2026-03-12] Backend CI (GitHub Actions) Added
### Added
- GitHub Actions 워크플로우(`.github/workflows/backend-tests.yml`)를 추가했다.
- `apps/backend` 변경 시 Python 3.12 환경에서 compile check와 unit test를 자동 실행하도록 구성했다.

### Changed
- 없음.

### Fixed
- 수동으로만 수행하던 백엔드 테스트 검증 절차를 CI 기반으로 보완했다.

### Validation
- ✅ `python -m compileall apps/backend/src`
- ✅ `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`

## [2026-03-12] Confluence Dynamic URL + ID/PW Auth (Read-only)
### Added
- `POST /v1/chat` 요청에서 Confluence 접속 정보를 직접 받을 수 있는 `confluence` 필드를 추가했다.
- 테스트용 Confluence 주소를 요청마다 다르게 넣어 즉시 검색 검증할 수 있도록 지원했다.

### Changed
- Confluence 인증 방식을 email/token에서 id/pw(Basic Auth) 기준으로 정리했다.
- 환경 변수 키를 `CONFLUENCE_USERNAME`, `CONFLUENCE_PASSWORD` 중심으로 변경했다.

### Fixed
- Confluence 연동이 환경 변수 고정값에만 의존하던 제약을 완화했다.

### Validation
- ✅ `python -m compileall apps/backend/src`
- ✅ `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`

## [2026-03-12] Confluence Version-aware Routing
### Added
- Confluence 버전 모드(`auto`, `cloud`, `server`)를 요청/환경 변수에서 지정할 수 있게 추가했다.
- `auto` 모드에서 Cloud/Server API 경로를 자동 판별하는 로직을 추가했다.
- 버전 분기 로직 검증용 테스트(`test_confluence_client.py`)를 추가했다.

### Changed
- `POST /v1/chat`의 `confluence` 객체에 `version` 필드를 추가했다.
- 앱 버전을 `0.4.0`으로 업데이트했다.

### Fixed
- Confluence 배포 버전에 따라 API prefix가 달라 발생할 수 있는 검색 실패 가능성을 완화했다.

### Validation
- ✅ `python -m compileall apps/backend/src`
- ✅ `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`

## [2026-03-12] Atlassian Env Alias Validation (Codex + GitHub Actions)
### Added
- `ATLASSIAN_URL`, `ATLASSIAN_ID`, `ATALSSIAN_PW` 환경 변수 alias를 backend config loader에 추가했다.
- GitHub Actions에서 해당 변수/시크릿을 읽어 필수값 검증 후 테스트를 실행하는 단계를 추가했다.
- alias 로딩 검증용 테스트(`test_config_env.py`)를 추가했다.

### Changed
- README의 환경 변수 안내를 Atlassian alias 중심으로 갱신했다.

### Fixed
- 환경 변수 명칭 불일치로 발생할 수 있는 설정 로딩 실패를 완화했다.

### Validation
- ✅ `python -m compileall apps/backend/src`
- ✅ `cd apps/backend && python -m unittest discover -s tests -p 'test_*.py'`
- ✅ `python - <<'PY'
from apps.backend.src.config import load_config
cfg = load_config()
print({"url_set": bool(cfg.confluence_base_url), "id_set": bool(cfg.confluence_username), "pw_set": bool(cfg.confluence_password)})
PY`
