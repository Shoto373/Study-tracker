from pydantic import BaseModel
from datetime import date


class SubjectBase(BaseModel):
    name: str
    color: str = "#3B82F6"
    target_hours_per_week: int = 0


class SubjectCreate(SubjectBase):
    pass


class SubjectOut(SubjectBase):
    id: int

    class Config:
        from_attributes = True


class SessionBase(BaseModel):
    subject_id: int
    date: date
    duration_minutes: int
    session_type: str = "self_study"
    note: str | None = None


class SessionCreate(SessionBase):
    pass


class SessionOut(SessionBase):
    id: int

    class Config:
        from_attributes = True


class DeadlineBase(BaseModel):
    subject_id: int
    title: str
    due_date: date
    is_done: bool = False


class DeadlineCreate(DeadlineBase):
    pass


class DeadlineOut(DeadlineBase):
    id: int

    class Config:
        from_attributes = True