"""Tests for the 2024 Adult Compendium PDF parser."""

from pathlib import Path

import pytest

from app.services.compendium_parser import parse_compendium_pdf

PDF_PATH = Path("/Users/alekseiarsenev/Downloads/1_2024-adult-compendium_1_2024 (1).pdf")


@pytest.mark.skipif(not PDF_PATH.is_file(), reason="Compendium PDF not available locally")
def test_parse_compendium_pdf_full_reference() -> None:
    rows = parse_compendium_pdf(PDF_PATH)

    assert len(rows) == 1097
    assert len({row.compendium_code for row in rows}) == 1097
    assert len({row.major_heading for row in rows}) == 22

    walking = next(row for row in rows if row.compendium_code == "17151")
    assert walking.major_heading == "Walking"
    assert walking.met_value == 2.3

    bicycling = next(row for row in rows if row.compendium_code == "01010")
    assert bicycling.major_heading == "Bicycling"
    assert bicycling.met_value == 4.0
