import unittest

from src.services.confluence_client import ConfluenceClient, ConfluenceClientError


class StubConfluenceClient(ConfluenceClient):
    def __init__(self, *args, available_paths=None, **kwargs):
        self.available_paths = available_paths or set()
        self.seen_urls: list[str] = []
        super().__init__(*args, **kwargs)

    def _request_json(self, url: str) -> dict:
        self.seen_urls.append(url)
        if any(url.endswith(path) for path in self.available_paths):
            return {"ok": True}

        if "/search?" in url:
            return {
                "results": [
                    {
                        "content": {
                            "id": "777",
                            "title": "Doc",
                            "_links": {"webui": "/spaces/ENG/pages/777"},
                        },
                        "excerpt": "<p>hello</p>",
                    }
                ]
            }

        if "/content/777?expand=body.storage" in url:
            return {"body": {"storage": {"value": "<h1>Hello</h1> world"}}}

        raise ConfluenceClientError("not reachable")


class ConfluenceClientVersionTest(unittest.TestCase):
    def test_explicit_server_mode_uses_rest_api_prefix(self):
        client = StubConfluenceClient(
            base_url="https://conf.example",
            username="id",
            password="pw",
            mode="server",
        )

        client.search_pages("hello", space_key="ENG", limit=1)
        self.assertTrue(any("/rest/api/search" in url for url in client.seen_urls))

    def test_auto_mode_picks_server_prefix_when_cloud_probe_fails(self):
        client = StubConfluenceClient(
            base_url="https://conf.example",
            username="id",
            password="pw",
            mode="auto",
            available_paths={"/rest/api/settings/systemInfo"},
        )

        client.search_pages("hello", space_key="ENG", limit=1)
        self.assertTrue(any("/rest/api/search" in url for url in client.seen_urls))

    def test_explicit_cloud_mode_uses_wiki_prefix(self):
        client = StubConfluenceClient(
            base_url="https://conf.example",
            username="id",
            password="pw",
            mode="cloud",
        )

        client.search_pages("hello", space_key="ENG", limit=1)
        self.assertTrue(any("/wiki/rest/api/search" in url for url in client.seen_urls))


if __name__ == "__main__":
    unittest.main()
