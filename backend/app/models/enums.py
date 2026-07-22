import enum


class UserRole(str, enum.Enum):
    athlete = "athlete"
    coach = "coach"
    admin = "admin"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"


class CoachAthleteLinkStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    paused = "paused"
    ended = "ended"


class CoachAthleteSessionEntryKind(str, enum.Enum):
    credit = "credit"
    debit = "debit"


class PlanActivityTier(str, enum.Enum):
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"


class ActivityCategory(str, enum.Enum):
    cardio = "cardio"
    strength = "strength"
    flexibility = "flexibility"
    team_sport = "team_sport"
    combat = "combat"
    other = "other"
    custom = "custom"


class ProgramStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class WorkoutStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"
    rescheduled = "rescheduled"


class WorkoutLogStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    partial = "partial"


class GoalStatus(str, enum.Enum):
    active = "active"
    achieved = "achieved"
    cancelled = "cancelled"
    expired = "expired"


class GoalMetricType(str, enum.Enum):
    weight = "weight"
    reps = "reps"
    duration = "duration"
    distance = "distance"
    sessions_count = "sessions_count"
    custom = "custom"


class ChallengeStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class ChallengeType(str, enum.Enum):
    sessions = "sessions"
    volume = "volume"
    streak = "streak"
    custom = "custom"


class NotificationChannel(str, enum.Enum):
    push = "push"
    in_app = "in_app"
    email = "email"


class MessageContextType(str, enum.Enum):
    general = "general"
    workout = "workout"
    workout_log = "workout_log"
    goal = "goal"
    substitution = "substitution"


class AiChatMessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"
