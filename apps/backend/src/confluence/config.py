from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(slots=True)
class AtlassianCredentials:
    base_url: str
    username: str
    token: str = ""
    password: str = ""

    @classmethod
    def from_env(cls) -> "AtlassianCredentials":
        return cls(
            base_url=os.environ.get("ATLASSIAN_URL", "").strip(),
            username=os.environ.get("ATLASSIAN_ID", "").strip(),
            token=os.environ.get("ATLASSIAN_TOKEN", "").strip(),
            password=os.environ.get("ATLASSIAN_PW", "").strip(),
        )

    @property
    def auth_secret(self) -> str:
        return self.token or self.password

    def validate(self) -> None:
        missing = []
        if not self.base_url:
            missing.append("ATLASSIAN_URL")
        if not self.username:
            missing.append("ATLASSIAN_ID")
        if not self.auth_secret:
            missing.append("ATLASSIAN_TOKEN or ATLASSIAN_PW")
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


def normalize_confluence_base_url(raw_url: str) -> str:
    url = raw_url.strip().rstrip("/")
    if "atlassian.net" in url and not url.endswith("/wiki"):
        return f"{url}/wiki"
    return url
