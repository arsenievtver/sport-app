from __future__ import annotations

import re
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path

import pdfplumber

HEADING_PART = r"(?:[A-Za-z][A-Za-z\s/&\-\.™()]+?)"
FULL_ROW_RE = re.compile(rf"^({HEADING_PART}\s+)?(\d{{5}})\s+(\d+\.?\d*)\s+(.+)$")
PARTIAL_ROW_RE = re.compile(rf"^({HEADING_PART}\s+)?(\d{{5}})\s+(\d+\.?\d*)\s*$")


@dataclass(frozen=True, slots=True)
class CompendiumActivityRow:
    major_heading: str
    compendium_code: str
    met_value: float
    name_en: str


@dataclass
class _PendingRow:
    major_heading: str
    compendium_code: str
    met_value: float
    description_parts: list[str] = field(default_factory=list)


def _join_description(parts: list[str]) -> str:
    return " ".join(part.strip() for part in parts if part.strip()).strip()


def _finalize_pending(pending: _PendingRow) -> CompendiumActivityRow:
    return CompendiumActivityRow(
        major_heading=pending.major_heading,
        compendium_code=pending.compendium_code,
        met_value=pending.met_value,
        name_en=_join_description(pending.description_parts),
    )


def _parse_row_marker(line: str) -> tuple[str | None, str, float, str | None] | None:
    full_match = FULL_ROW_RE.match(line)
    if full_match:
        heading_part, code, met, description = full_match.groups()
        return heading_part, code, float(met), description.strip()

    partial_match = PARTIAL_ROW_RE.match(line)
    if partial_match:
        heading_part, code, met = partial_match.groups()
        return heading_part, code, float(met), None

    return None


def _close_pending(
    pending: _PendingRow,
    continuation_buffer: list[str],
) -> tuple[CompendiumActivityRow, list[str]]:
    orphan_for_next: list[str] = []
    if len(continuation_buffer) >= 2:
        orphan_for_next = [continuation_buffer[-1]]
        pending.description_parts.extend(continuation_buffer[:-1])
    else:
        pending.description_parts.extend(continuation_buffer)

    return _finalize_pending(pending), orphan_for_next


def _parse_lines(lines: list[str]) -> list[CompendiumActivityRow]:
    activities: list[CompendiumActivityRow] = []
    current_heading: str | None = None
    orphan_lines: list[str] = []
    pending: _PendingRow | None = None
    continuation_buffer: list[str] = []

    def start_pending(heading: str | None, code: str, met: float) -> None:
        nonlocal pending, orphan_lines, continuation_buffer
        prefix = _join_description(orphan_lines)
        orphan_lines = []
        continuation_buffer = []
        pending = _PendingRow(
            major_heading=current_heading or "",
            compendium_code=code,
            met_value=met,
            description_parts=[prefix] if prefix else [],
        )

    for raw_line in lines:
        line = raw_line.strip()
        if not line or "Major Heading" in line or "2024 Adult Compendium" in line:
            continue

        marker = _parse_row_marker(line)
        if marker is not None:
            heading_part, code, met, inline_description = marker
            if heading_part:
                current_heading = heading_part.strip()
            if not current_heading:
                raise ValueError(f"Activity {code} has no major heading")

            if pending is not None:
                activity, orphan_lines = _close_pending(pending, continuation_buffer)
                activities.append(activity)
                pending = None
                continuation_buffer = []

            if inline_description is not None:
                prefix = _join_description(orphan_lines)
                orphan_lines = []
                description = f"{prefix} {inline_description}".strip() if prefix else inline_description
                activities.append(
                    CompendiumActivityRow(
                        major_heading=current_heading,
                        compendium_code=code,
                        met_value=met,
                        name_en=description,
                    ),
                )
            else:
                start_pending(heading_part, code, met)
            continue

        if pending is not None:
            continuation_buffer.append(line)
        else:
            orphan_lines.append(line)

    if pending is not None:
        activity, orphan_lines = _close_pending(pending, continuation_buffer)
        activities.append(activity)

    return activities


def parse_compendium_pdf(source: bytes | bytearray | Path | str | BytesIO) -> list[CompendiumActivityRow]:
    """Parse the 2024 Adult Compendium PDF into structured activity rows."""
    if isinstance(source, (bytes, bytearray)):
        pdf_source: bytes | str | BytesIO = BytesIO(bytes(source))
    elif isinstance(source, BytesIO):
        source.seek(0)
        pdf_source = source
    elif isinstance(source, Path):
        pdf_source = str(source)
    else:
        pdf_source = source

    lines: list[str] = []
    with pdfplumber.open(pdf_source) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines.extend(text.split("\n"))

    activities = _parse_lines(lines)

    if not activities:
        raise ValueError("PDF does not contain compendium activities")

    codes = [row.compendium_code for row in activities]
    if len(codes) != len(set(codes)):
        duplicates = sorted({code for code in codes if codes.count(code) > 1})
        raise ValueError(f"Duplicate compendium codes found in PDF: {', '.join(duplicates[:5])}")

    return activities


def parse_compendium_pdf_file(path: Path) -> list[CompendiumActivityRow]:
    return parse_compendium_pdf(path)


def parse_compendium_pdf_bytes(data: bytes) -> list[CompendiumActivityRow]:
    return parse_compendium_pdf(data)
