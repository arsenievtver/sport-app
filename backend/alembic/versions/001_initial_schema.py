"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-13

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Import all models so metadata is populated
    from app.models import (  # noqa: F401
        AnalyticsEvent,
        AthleteProfile,
        Challenge,
        ChallengeParticipant,
        CoachAthleteLink,
        CoachProfile,
        Exercise,
        Goal,
        Message,
        MessageThread,
        Notification,
        Program,
        ProgramWeek,
        ProgressSnapshot,
        User,
        Workout,
        WorkoutExercise,
        WorkoutLog,
        WorkoutLogExercise,
    )
    from app.models.base import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.models import (  # noqa: F401
        AnalyticsEvent,
        AthleteProfile,
        Challenge,
        ChallengeParticipant,
        CoachAthleteLink,
        CoachProfile,
        Exercise,
        Goal,
        Message,
        MessageThread,
        Notification,
        Program,
        ProgramWeek,
        ProgressSnapshot,
        User,
        Workout,
        WorkoutExercise,
        WorkoutLog,
        WorkoutLogExercise,
    )
    from app.models.base import Base

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
