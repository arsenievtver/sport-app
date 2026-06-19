"""activity types reference table and session load fields

Revision ID: 012
Revises: 011
Create Date: 2026-06-19

MET values from the 2024 Adult Compendium of Physical Activities (pacompendium.com).
"""

from typing import Sequence, Union
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")


def _activity_id(code: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"pacompendium:{code}"))


# Curated subset for the athlete app UI (2024 Adult Compendium codes + MET).
# (code, name_ru, name_en from Compendium, category, met, sort_order)
ACTIVITY_TYPES = [
    ("12020", "Ходьба", "Walking, 2.8 mph, level", "cardio", 3.5, 10),
    ("12050", "Бег (умеренный темп)", "Running, 6 mph", "cardio", 9.8, 20),
    ("12100", "Бег (быстрый темп)", "Running, 10 mph", "cardio", 14.5, 30),
    ("01010", "Велосипед (спокойный темп)", "Bicycling, <10 mph, leisure", "cardio", 4.0, 40),
    ("01310", "Велосипед (интенсивный темп)", "Bicycling, 12-13.9 mph", "cardio", 8.0, 50),
    ("15675", "Плавание (умеренная интенсивность)", "Swimming, moderate effort", "cardio", 5.8, 60),
    ("17025", "Эллиптический тренажёр", "Elliptical trainer", "cardio", 5.0, 70),
    ("17010", "Подъём по лестнице", "Stair climbing", "cardio", 9.0, 80),
    ("15420", "Гребной тренажёр", "Rowing, stationary", "cardio", 7.0, 90),
    ("17200", "Пеший туризм", "Hiking cross country", "cardio", 6.0, 100),
    ("17151", "Силовая тренировка", "Resistance training, general", "strength", 3.5, 110),
    ("17170", "Силовая тренировка (интенсивная)", "Resistance training, vigorous", "strength", 6.0, 120),
    ("18310", "Калистеника (умеренная)", "Calisthenics, moderate", "strength", 3.8, 130),
    ("18320", "Калистеника (интенсивная)", "Calisthenics, vigorous", "strength", 8.0, 140),
    ("17135", "Круговая тренировка", "Circuit training", "strength", 8.0, 150),
    ("19018", "Йога", "Yoga", "flexibility", 2.5, 160),
    ("19030", "Пилатес", "Pilates", "flexibility", 3.0, 170),
    ("18450", "Растяжка", "Stretching", "flexibility", 2.3, 180),
    ("15040", "Баскетбол", "Basketball, game", "team_sport", 6.5, 190),
    ("15050", "Футбол", "Soccer, casual", "team_sport", 7.0, 200),
    ("15430", "Теннис", "Tennis, general", "team_sport", 7.3, 210),
    ("02050", "Аэробика", "Aerobic dance", "other", 6.5, 220),
    ("18220", "Бокс", "Boxing, sparring", "combat", 9.0, 230),
    ("18260", "Единоборства", "Martial arts, moderate pace", "combat", 10.3, 240),
]


def upgrade() -> None:
    op.create_table(
        "activity_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("compendium_code", sa.String(length=16), nullable=False),
        sa.Column("name_ru", sa.String(length=120), nullable=False),
        sa.Column("name_en", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("met_value", sa.Float(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("compendium_code"),
    )
    op.create_index(op.f("ix_activity_types_category"), "activity_types", ["category"], unique=False)
    op.create_index(
        op.f("ix_activity_types_compendium_code"),
        "activity_types",
        ["compendium_code"],
        unique=True,
    )

    activity_types_table = sa.table(
        "activity_types",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("compendium_code", sa.String),
        sa.column("name_ru", sa.String),
        sa.column("name_en", sa.String),
        sa.column("category", sa.String),
        sa.column("met_value", sa.Float),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        activity_types_table,
        [
            {
                "id": _activity_id(code),
                "compendium_code": code,
                "name_ru": name_ru,
                "name_en": name_en,
                "category": category,
                "met_value": met,
                "sort_order": sort_order,
                "is_active": True,
            }
            for code, name_ru, name_en, category, met, sort_order in ACTIVITY_TYPES
        ],
    )

    op.add_column(
        "coach_athlete_session_entries",
        sa.Column("activity_type_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("coach_athlete_session_entries", sa.Column("duration_min", sa.Integer(), nullable=True))
    op.add_column("coach_athlete_session_entries", sa.Column("effort", sa.Integer(), nullable=True))
    op.add_column("coach_athlete_session_entries", sa.Column("effective_met", sa.Float(), nullable=True))
    op.add_column(
        "coach_athlete_session_entries",
        sa.Column("load_met_minutes", sa.Float(), nullable=True),
    )
    op.create_foreign_key(
        "fk_session_entries_activity_type_id",
        "coach_athlete_session_entries",
        "activity_types",
        ["activity_type_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_coach_athlete_session_entries_activity_type_id"),
        "coach_athlete_session_entries",
        ["activity_type_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_coach_athlete_session_entries_activity_type_id"),
        table_name="coach_athlete_session_entries",
    )
    op.drop_constraint(
        "fk_session_entries_activity_type_id",
        "coach_athlete_session_entries",
        type_="foreignkey",
    )
    op.drop_column("coach_athlete_session_entries", "load_met_minutes")
    op.drop_column("coach_athlete_session_entries", "effective_met")
    op.drop_column("coach_athlete_session_entries", "effort")
    op.drop_column("coach_athlete_session_entries", "duration_min")
    op.drop_column("coach_athlete_session_entries", "activity_type_id")
    op.drop_index(op.f("ix_activity_types_compendium_code"), table_name="activity_types")
    op.drop_index(op.f("ix_activity_types_category"), table_name="activity_types")
    op.drop_table("activity_types")
