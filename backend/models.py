from sqlalchemy import Column, Integer, String, ForeignKey, Date, Boolean
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#3B82F6")
    target_hours_per_week = Column(Integer, default=0)
    # Client IP the subject belongs to; '' for rows created before ownership existed.
    owner = Column(String, nullable=False, default="", index=True)
    # Name this subject had in the timetable, if imported; survives renames.
    source = Column(String, nullable=True)

    sessions = relationship("Session", back_populates="subject", cascade="all, delete-orphan")
    deadlines = relationship("Deadline", back_populates="subject", cascade="all, delete-orphan")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    date = Column(Date, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    session_type = Column(String, default="self_study")
    note = Column(String, nullable=True)

    subject = relationship("Subject", back_populates="sessions")


class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    title = Column(String, nullable=False)
    due_date = Column(Date, nullable=False)
    is_done = Column(Boolean, default=False)

    subject = relationship("Subject", back_populates="deadlines")


class UserGroup(Base):
    """Timetable group pinned to a client IP."""
    __tablename__ = "user_groups"

    ip = Column(String, primary_key=True)
    faculty = Column(Integer, nullable=False)
    group_id = Column(Integer, nullable=False)
    group_name = Column(String, nullable=False)


class DismissedSubject(Base):
    """Timetable subject the user deleted; imports must not bring it back."""
    __tablename__ = "dismissed_subjects"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)  # casefolded
