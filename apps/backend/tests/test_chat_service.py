from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.chat_service import ChatDependencies, ChatService, SessionStore
from src.models import CreateSessionRequest, ProviderConfig, SendMessageRequest, SessionSkillUpdateRequest
from src.skills import SkillRegistry
from src.tool_runner import ToolRunner


class ChatServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.service = ChatService(
            dependencies=ChatDependencies(skills=SkillRegistry(), tools=ToolRunner()),
            store=SessionStore(),
        )
        self.provider_config = ProviderConfig()

    async def test_skill_state_is_session_scoped(self) -> None:
        first = self.service.create_session(CreateSessionRequest(providerConfig=self.provider_config))
        second = self.service.create_session(CreateSessionRequest(providerConfig=self.provider_config))

        self.service.activate_skill(
            first.session_id,
            SessionSkillUpdateRequest(skillId="release-note-draft"),
        )

        updated = await self.service.send_message(
            first.session_id,
            SendMessageRequest(content="Draft release notes for the latest sync."),
        )
        assert updated is not None
        self.assertEqual(updated.active_skill_ids, ["release-note-draft"])
        self.assertEqual(updated.messages[-1].applied_skill_names, ["release-note-draft"])

        untouched = self.service.get_session(second.session_id)
        assert untouched is not None
        self.assertEqual(untouched.active_skill_ids, [])


if __name__ == "__main__":
    unittest.main()
