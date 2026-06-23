from sqlalchemy import Column, Integer, String, ForeignKey, Date, Boolean
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#3B82F6")
    target_hours_per_week = Column(Integer, default=0)

    sessions = relationship("Session", back_populates="subject")
    deadlines = relationship("Deadline", back_populates="subject")

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