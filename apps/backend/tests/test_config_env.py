import os
import unittest
from unittest.mock import patch

from src.config import load_config


class ConfigEnvTest(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "ATLASSIAN_URL": "https://atlassian.example",
            "ATLASSIAN_ID": "user-id",
            "ATALSSIAN_PW": "pw-typo-key",
            "CONFLUENCE_BASE_URL": "https://should-not-win.example",
            "CONFLUENCE_USERNAME": "legacy-user",
            "CONFLUENCE_PASSWORD": "legacy-pw",
        },
        clear=True,
    )
    def test_prefers_atlassian_aliases(self):
        config = load_config()
        self.assertEqual(config.confluence_base_url, "https://atlassian.example")
        self.assertEqual(config.confluence_username, "user-id")
        self.assertEqual(config.confluence_password, "pw-typo-key")

    @patch.dict(
        os.environ,
        {
            "CONFLUENCE_BASE_URL": "https://legacy.example",
            "CONFLUENCE_USERNAME": "legacy-user",
            "CONFLUENCE_PASSWORD": "legacy-pw",
        },
        clear=True,
    )
    def test_falls_back_to_confluence_env_names(self):
        config = load_config()
        self.assertEqual(config.confluence_base_url, "https://legacy.example")
        self.assertEqual(config.confluence_username, "legacy-user")
        self.assertEqual(config.confluence_password, "legacy-pw")


if __name__ == "__main__":
    unittest.main()
