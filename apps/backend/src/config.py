from dataclasses import dataclass
from os import getenv


def _first_non_empty(*keys: str, default: str = "") -> str:
    for key in keys:
        value = getenv(key, "")
        if value:
            return value
    return default


@dataclass(frozen=True)
class BackendConfig:
    confluence_base_url: str
    confluence_username: str
    confluence_password: str
    confluence_space_key: str
    confluence_version: str

    @property
    def is_confluence_configured(self) -> bool:
        return all(
            [
                self.confluence_base_url.strip(),
                self.confluence_username.strip(),
                self.confluence_password.strip(),
            ]
        )


def load_config() -> BackendConfig:
    return BackendConfig(
        # Prefer ATLASSIAN_* aliases requested by user; fallback to CONFLUENCE_*
        confluence_base_url=_first_non_empty("ATLASSIAN_URL", "CONFLUENCE_BASE_URL").rstrip("/"),
        confluence_username=_first_non_empty("ATLASSIAN_ID", "CONFLUENCE_USERNAME"),
        # Keep typo-compatible key(ATALSSIAN_PW) first, then corrected ATLASSIAN_PW, then legacy key.
        confluence_password=_first_non_empty("ATALSSIAN_PW", "ATLASSIAN_PW", "CONFLUENCE_PASSWORD"),
        confluence_space_key=_first_non_empty("CONFLUENCE_SPACE_KEY", default="ENG"),
        confluence_version=_first_non_empty("CONFLUENCE_VERSION", default="auto"),
    )
