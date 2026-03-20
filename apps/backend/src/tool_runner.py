from __future__ import annotations

import asyncio
import json
from pathlib import Path

from .models import SkillRecord, SkillToolManifestEntry, ToolCall, ToolExecutionResult


class ToolRunner:
    async def execute(self, skill: SkillRecord, tool_call: ToolCall) -> ToolExecutionResult:
        tool = self._find_tool(skill, tool_call.name)
        if tool is None:
            return ToolExecutionResult(
                toolCallId=tool_call.id,
                toolName=tool_call.name,
                content=f"Tool '{tool_call.name}' is not declared in skill.tools.json.",
                isError=True,
                traceLine=f"Blocked undeclared tool: {tool_call.name}",
            )

        workdir = self._resolve_workdir(skill, tool)
        argv = tool.command + [json.dumps(tool_call.arguments, ensure_ascii=True)]
        process = await asyncio.create_subprocess_exec(
            *argv,
            cwd=str(workdir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=tool.timeout_ms / 1000)
        except TimeoutError:
            process.kill()
            await process.wait()
            return ToolExecutionResult(
                toolCallId=tool_call.id,
                toolName=tool.name,
                content=f"Tool '{tool.name}' timed out after {tool.timeout_ms}ms.",
                isError=True,
                traceLine=f"Tool timed out: {tool.name}",
            )

        output = stdout.decode("utf-8", errors="ignore").strip()
        error_output = stderr.decode("utf-8", errors="ignore").strip()
        if process.returncode != 0:
            content = error_output or output or f"Tool exited with code {process.returncode}."
            return ToolExecutionResult(
                toolCallId=tool_call.id,
                toolName=tool.name,
                content=content,
                isError=True,
                traceLine=f"Tool failed: {tool.name}",
            )

        return ToolExecutionResult(
            toolCallId=tool_call.id,
            toolName=tool.name,
            content=output or "(no output)",
            isError=False,
            traceLine=f"Tool executed: {tool.name}",
        )

    def _find_tool(self, skill: SkillRecord, tool_name: str) -> SkillToolManifestEntry | None:
        for tool in skill.manifest_tools:
            if tool.name == tool_name:
                return tool
        return None

    def _resolve_workdir(self, skill: SkillRecord, tool: SkillToolManifestEntry) -> Path:
        skill_root = Path(skill.root_path).resolve()
        if not tool.allowed_workdir:
            return skill_root
        workdir = (skill_root / tool.allowed_workdir).resolve()
        workdir.relative_to(skill_root)
        return workdir
