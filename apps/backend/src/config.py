from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class BackendConfig:
    confluence_base_url: str
    confluence_email: str
    confluence_api_token: str
    confluence_space_key: str

    @property
    def is_confluence_configured(self) -> bool:
        return all(
            [
                self.confluence_base_url.strip(),
                self.confluence_email.strip(),
                self.confluence_api_token.strip(),
            ]
        )


def load_config() -> BackendConfig:
    return BackendConfig(
        confluence_base_url=getenv("CONFLUENCE_BASE_URL", "").rstrip("/"),
        confluence_email=getenv("CONFLUENCE_EMAIL", ""),
        confluence_api_token=getenv("CONFLUENCE_API_TOKEN", ""),
        confluence_space_key=getenv("CONFLUENCE_SPACE_KEY", "ENG"),
    )
