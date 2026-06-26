from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pdfplumber

ROW_RE = re.compile(
    r"^((?:[A-Za-z][A-Za-z\s/&\-\.™()]+?)\s+)?(\d{5})\s+(\d+\.?\d*)\s+(.+)$"
)


@dataclass(frozen=True, slots=True)
class CompendiumActivityRow:
    major_heading: str
    compendium_code: str
    met_value: float
    name_en: str


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

    activities: list[CompendiumActivityRow] = []
    current_heading: str | None = None

    with pdfplumber.open(pdf_source) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw_line in text.split("\n"):
                line = raw_line.strip()
                if not line or "Major Heading" in line or "2024 Adult Compendium" in line:
                    continue

                match = ROW_RE.match(line)
                if match:
                    heading_part, code, met, description = match.groups()
                    if heading_part:
                        current_heading = heading_part.strip()
                    if not current_heading:
                        raise ValueError(f"Activity {code} has no major heading")
                    activities.append(
                        CompendiumActivityRow(
                            major_heading=current_heading,
                            compendium_code=code,
                            met_value=float(met),
                            name_en=description.strip(),
                        ),
                    )
                elif activities and not re.match(r"^\d{5}\s", line):
                    prev = activities[-1]
                    activities[-1] = CompendiumActivityRow(
                        major_heading=prev.major_heading,
                        compendium_code=prev.compendium_code,
                        met_value=prev.met_value,
                        name_en=f"{prev.name_en} {line}".strip(),
                    )

    if not activities:
        raise ValueError("PDF does not contain compendium activities")

    codes = [row.compendium_code for row in activities]
    if len(codes) != len(set(codes)):
        raise ValueError("Duplicate compendium codes found in PDF")

    return activities


def parse_compendium_pdf_file(path: Path) -> list[CompendiumActivityRow]:
    return parse_compendium_pdf(path)


def parse_compendium_pdf_bytes(data: bytes) -> list[CompendiumActivityRow]:
    return parse_compendium_pdf(data)
