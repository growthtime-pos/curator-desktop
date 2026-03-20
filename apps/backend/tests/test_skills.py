from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.models import ProviderConfig, ToolCall
from src.skills import SkillRegistry
from src.tool_runner import ToolRunner


class SkillRegistryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.registry = SkillRegistry()
        self.provider_config = ProviderConfig()

    def test_loads_workspace_skills(self) -> None:
        skills = self.registry.list_skills(self.provider_config)
        skill_ids = {skill.id for skill in skills}
        self.assertIn("release-note-draft", skill_ids)
        self.assertIn("confluence-summarizer", skill_ids)
        self.assertIn("workspace-toolkit", skill_ids)

        workspace_skill = next(skill for skill in skills if skill.id == "workspace-toolkit")
        self.assertTrue(workspace_skill.reference_files)
        self.assertEqual(workspace_skill.tool_definitions[0].name, "list_workspace_overview")

    def test_prefers_explicit_match(self) -> None:
        recommendations = self.registry.recommend(
            message="Use $workspace-toolkit to show me the repo files.",
            active_skill_ids=[],
            provider_config=self.provider_config,
        )

        self.assertGreater(len(recommendations), 0)
        self.assertEqual(recommendations[0].skill.id, "workspace-toolkit")
        self.assertTrue(recommendations[0].explicit)

    async def test_tool_runner_executes_declared_tool(self) -> None:
        skill = self.registry.get_skill("workspace-toolkit", self.provider_config)
        assert skill is not None

        result = await ToolRunner().execute(
            skill,
            ToolCall(id="call_1", name="list_workspace_overview", arguments={}),
        )

        self.assertFalse(result.is_error)
        self.assertIn("apps/", result.content)
        self.assertIn("packages/", result.content)


if __name__ == "__main__":
    unittest.main()
