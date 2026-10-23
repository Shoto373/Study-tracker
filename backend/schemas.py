from pydantic import BaseModel, ConfigDict, Field
from datetime import date


class SubjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#3B82F6", pattern=r"^#[0-9a-fA-F]{6}$")
    target_hours_per_week: int = Field(default=0, ge=0, le=168)


class SubjectCreate(SubjectBase):
    pass


class SubjectOut(SubjectBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SessionBase(BaseModel):
    subject_id: int
    date: date
    duration_minutes: int = Field(gt=0, le=1440)
    session_type: str = "self_study"
    note: str | None = None


class SessionCreate(SessionBase):
    pass


class SessionOut(SessionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class DeadlineBase(BaseModel):
    subject_id: int
    title: str = Field(min_length=1, max_length=200)
    due_date: date
    is_done: bool = False


class DeadlineCreate(DeadlineBase):
    pass


class DeadlineOut(DeadlineBase):
    id: int

    model_config = ConfigDict(from_attributes=True)