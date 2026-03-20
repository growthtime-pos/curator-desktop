from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from .models import (
    ProviderConfig,
    SkillRecommendation,
    SkillRecord,
    SkillSummary,
    SkillToolDefinition,
    SkillToolManifest,
    SkillToolManifestEntry,
)

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CODEX_HOME = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
PATH_TOKEN_RE = re.compile(r"(?:references|scripts|assets)/[A-Za-z0-9_./-]+")
WORD_RE = re.compile(r"[a-z0-9][a-z0-9_-]{1,}")


@dataclass(slots=True)
class LoadedSkill:
    record: SkillRecord
    search_blob: str


class SkillSummaryCache:
    def __init__(self) -> None:
        self._cache: dict[tuple[str, int, int], str] = {}

    def summarize(self, file_path: Path, max_chars: int = 2_000) -> str:
        stat = file_path.stat()
        cache_key = (str(file_path), stat.st_mtime_ns, max_chars)
        cached = self._cache.get(cache_key)
        if cached:
            return cached

        raw = file_path.read_text(encoding="utf-8", errors="ignore").strip()
        if len(raw) <= max_chars:
            summary = raw
        else:
            head = raw[: max_chars // 2].strip()
            tail = raw[-max_chars // 3 :].strip()
            summary = f"{head}\n\n...[truncated]...\n\n{tail}"
        self._cache[cache_key] = summary
        return summary


class SkillRegistry:
    def __init__(self) -> None:
        self._summary_cache = SkillSummaryCache()

    def list_skills(self, provider_config: ProviderConfig | None = None) -> list[SkillRecord]:
        return [loaded.record for loaded in self._scan(provider_config)]

    def get_skill(self, skill_id: str, provider_config: ProviderConfig | None = None) -> SkillRecord | None:
        for loaded in self._scan(provider_config):
            if loaded.record.id == skill_id:
                return loaded.record
        return None

    def recommend(
        self,
        message: str,
        active_skill_ids: list[str],
        provider_config: ProviderConfig | None = None,
    ) -> list[SkillRecommendation]:
        lowered = message.lower()
        message_tokens = set(self._tokenize(lowered))
        recommendations: list[SkillRecommendation] = []

        for loaded in self._scan(provider_config):
            record = loaded.record
            if record.id in active_skill_ids:
                continue

            explicit = self._is_explicit_match(lowered, record)
            lexical_score = self._lexical_score(message_tokens, loaded.search_blob)
            if not explicit and lexical_score <= 0:
                continue

            score = lexical_score + (10.0 if explicit else 0.0)
            reason = "Explicit skill mention" if explicit else "Keyword match in skill metadata"
            recommendations.append(
                SkillRecommendation(
                    skill=SkillSummary.model_validate(record.model_dump(by_alias=True)),
                    score=round(score, 3),
                    reason=reason,
                    explicit=explicit,
                )
            )

        recommendations.sort(key=lambda item: (-item.score, item.skill.name.lower()))
        return recommendations[:5]

    def render_skill_context(self, skills: list[SkillRecord], max_total_chars: int = 8_000) -> list[str]:
        sections: list[str] = []
        remaining = max_total_chars
        for skill in skills:
            body = "\n".join(
                part
                for part in [f"Skill: {skill.name}", f"Description: {skill.description}", skill.body.strip()]
                if part
            )
            if body:
                block = body[:remaining]
                sections.append(block)
                remaining -= len(block)
            if remaining <= 0:
                break

            for ref in skill.reference_files:
                file_path = Path(ref)
                if not file_path.exists():
                    continue
                summary = self._summary_cache.summarize(file_path, max_chars=min(1_500, remaining))
                block = f"Reference file: {file_path.name}\n{summary}"[:remaining]
                sections.append(block)
                remaining -= len(block)
                if remaining <= 0:
                    break
        return sections

    def _scan(self, provider_config: ProviderConfig | None) -> list[LoadedSkill]:
        loaded_by_id: dict[str, LoadedSkill] = {}
        for root in self._iter_skill_roots(provider_config):
            if not root.exists() or not root.is_dir():
                continue
            for skill_dir in sorted(root.iterdir()):
                if not skill_dir.is_dir():
                    continue
                skill = self._load_skill(skill_dir)
                if skill is None:
                    continue
                loaded_by_id[skill.record.id] = skill
        return list(loaded_by_id.values())

    def _iter_skill_roots(self, provider_config: ProviderConfig | None) -> list[Path]:
        roots = [
            DEFAULT_CODEX_HOME / "skills",
            WORKSPACE_ROOT / ".codex" / "skills",
        ]
        extra = provider_config.skill_root_paths if provider_config else []
        for raw_path in extra:
            candidate = Path(raw_path).expanduser()
            if not candidate.is_absolute():
                candidate = (WORKSPACE_ROOT / candidate).resolve()
            roots.append(candidate)

        deduped: list[Path] = []
        seen: set[str] = set()
        for root in roots:
            normalized = str(root.resolve()) if root.exists() else str(root)
            if normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(root)
        return deduped

    def _load_skill(self, skill_dir: Path) -> LoadedSkill | None:
        skill_path = skill_dir / "SKILL.md"
        if not skill_path.exists():
            return None

        raw = skill_path.read_text(encoding="utf-8", errors="ignore")
        metadata, body = self._split_frontmatter(raw)
        name = metadata.get("name") or self._extract_heading(body) or skill_dir.name
        description = metadata.get("description") or self._extract_first_paragraph(body) or "No description provided."
        reference_files = self._extract_reference_files(skill_dir, body)
        script_candidates = [
            str(path)
            for path in reference_files
            if "/scripts/" in path.as_posix() or "/assets/" in path.as_posix()
        ]
        manifest_tools, load_errors = self._load_manifest(skill_dir)
        tool_definitions = [
            SkillToolDefinition(
                name=tool.name,
                description=tool.description,
                inputSchema=tool.input_schema,
            )
            for tool in manifest_tools
        ]
        skill_id = self._normalize_id(metadata.get("name") or skill_dir.name)

        record = SkillRecord(
            id=skill_id,
            name=name,
            description=description,
            rootPath=str(skill_dir),
            sourcePath=str(skill_path),
            body=body.strip(),
            referenceFiles=[str(path) for path in reference_files],
            manifestTools=manifest_tools,
            toolDefinitions=tool_definitions,
            scriptCandidates=script_candidates,
            loadErrors=load_errors,
        )
        search_blob = " ".join([record.id, record.name, record.description, record.body]).lower()
        return LoadedSkill(record=record, search_blob=search_blob)

    def _split_frontmatter(self, raw: str) -> tuple[dict[str, str], str]:
        match = FRONTMATTER_RE.match(raw)
        if not match:
            return {}, raw

        metadata: dict[str, str] = {}
        for line in match.group(1).splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or ":" not in stripped:
                continue
            key, value = stripped.split(":", 1)
            metadata[key.strip()] = value.strip().strip("'\"")
        return metadata, raw[match.end() :]

    def _extract_heading(self, body: str) -> str | None:
        for line in body.splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                return stripped.lstrip("#").strip()
        return None

    def _extract_first_paragraph(self, body: str) -> str | None:
        paragraphs = [part.strip() for part in body.split("\n\n")]
        for paragraph in paragraphs:
            if paragraph and not paragraph.startswith("#"):
                return paragraph.replace("\n", " ")
        return None

    def _extract_reference_files(self, skill_dir: Path, body: str) -> list[Path]:
        candidates = set(MARKDOWN_LINK_RE.findall(body))
        candidates.update(PATH_TOKEN_RE.findall(body))
        resolved: list[Path] = []
        for candidate in sorted(candidates):
            if "://" in candidate or candidate.startswith("app://") or candidate.startswith("plugin://"):
                continue
            candidate_path = (skill_dir / candidate).resolve()
            try:
                candidate_path.relative_to(skill_dir.resolve())
            except ValueError:
                continue
            if candidate_path.exists() and candidate_path.is_file():
                resolved.append(candidate_path)
        return resolved

    def _load_manifest(self, skill_dir: Path) -> tuple[list[SkillToolManifestEntry], list[str]]:
        manifest_path = skill_dir / "skill.tools.json"
        if not manifest_path.exists():
            return [], []

        try:
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest = SkillToolManifest.model_validate(payload)
        except Exception as exc:  # noqa: BLE001
            return [], [f"Invalid skill.tools.json: {exc}"]

        tools: list[SkillToolManifestEntry] = []
        errors: list[str] = []
        root = skill_dir.resolve()
        for tool in manifest.tools:
            if not tool.command:
                errors.append(f"Tool '{tool.name}' has no command.")
                continue
            if tool.allowed_workdir:
                allowed = (skill_dir / tool.allowed_workdir).resolve()
                try:
                    allowed.relative_to(root)
                except ValueError:
                    errors.append(f"Tool '{tool.name}' has an out-of-root allowedWorkdir.")
                    continue
            tools.append(tool)
        return tools, errors

    def _normalize_id(self, value: str) -> str:
        cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return cleaned or "skill"

    def _tokenize(self, value: str) -> list[str]:
        return WORD_RE.findall(value)

    def _is_explicit_match(self, lowered_message: str, record: SkillRecord) -> bool:
        names = {record.id.lower(), record.name.lower(), f"${record.id.lower()}", f"${record.name.lower()}"}
        return any(name in lowered_message for name in names)

    def _lexical_score(self, message_tokens: set[str], search_blob: str) -> float:
        if not message_tokens:
            return 0.0
        skill_tokens = set(self._tokenize(search_blob))
        return float(len(message_tokens.intersection(skill_tokens)))
