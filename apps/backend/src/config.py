from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class BackendConfig:
    confluence_base_url: str
    confluence_username: str
    confluence_password: str
    confluence_space_key: str

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
        confluence_base_url=getenv("CONFLUENCE_BASE_URL", "").rstrip("/"),
        confluence_username=getenv("CONFLUENCE_USERNAME", ""),
        confluence_password=getenv("CONFLUENCE_PASSWORD", ""),
        confluence_space_key=getenv("CONFLUENCE_SPACE_KEY", "ENG"),
    )
