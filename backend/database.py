from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///./study_tracker.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

# create_all does not alter existing tables: add new columns to old databases.
with engine.begin() as conn:
    columns = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(subjects)")]
    if "owner" not in columns:
        conn.exec_driver_sql("ALTER TABLE subjects ADD COLUMN owner VARCHAR NOT NULL DEFAULT ''")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_subjects_owner ON subjects (owner)")
    if "source" not in columns:
        conn.exec_driver_sql("ALTER TABLE subjects ADD COLUMN source VARCHAR")
        # Subjects of users with a pinned group were imported from the timetable.
        conn.exec_driver_sql(
            "UPDATE subjects SET source = name WHERE owner IN (SELECT ip FROM user_groups)"
        )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()