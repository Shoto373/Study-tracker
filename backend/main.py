from datetime import date, timedelta

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DbSession
import database
import models
import schemas

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Study Tracker API is running"}

@app.post("/subjects/", response_model=schemas.SubjectOut)
def create_subject(subject: schemas.SubjectCreate, db: DbSession = Depends(database.get_db)):
    db_subject = models.Subject(**subject.model_dump())
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@app.get("/subjects/", response_model=list[schemas.SubjectOut])
def list_subjects(db: DbSession = Depends(database.get_db)):
    return db.query(models.Subject).all()

@app.post("/sessions/", response_model=schemas.SessionOut)
def create_session(session: schemas.SessionCreate, db: DbSession = Depends(database.get_db)):
    _require_subject(db, session.subject_id)
    db_session = models.Session(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@app.get("/sessions/", response_model=list[schemas.SessionOut])
def list_sessions(
    subject_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: DbSession = Depends(database.get_db),
):
    q = db.query(models.Session)
    if subject_id is not None:
        q = q.filter(models.Session.subject_id == subject_id)
    if date_from is not None:
        q = q.filter(models.Session.date >= date_from)
    if date_to is not None:
        q = q.filter(models.Session.date <= date_to)
    return q.order_by(models.Session.date.desc(), models.Session.id.desc()).all()


@app.post("/deadlines/", response_model=schemas.DeadlineOut)
def create_deadline(deadline: schemas.DeadlineCreate, db: DbSession = Depends(database.get_db)):
    _require_subject(db, deadline.subject_id)
    db_deadline = models.Deadline(**deadline.model_dump())
    db.add(db_deadline)
    db.commit()
    db.refresh(db_deadline)
    return db_deadline


@app.get("/deadlines/", response_model=list[schemas.DeadlineOut])
def list_deadlines(
    subject_id: int | None = None,
    is_done: bool | None = None,
    due_before: date | None = None,
    db: DbSession = Depends(database.get_db),
):
    q = db.query(models.Deadline)
    if subject_id is not None:
        q = q.filter(models.Deadline.subject_id == subject_id)
    if is_done is not None:
        q = q.filter(models.Deadline.is_done == is_done)
    if due_before is not None:
        q = q.filter(models.Deadline.due_date < due_before)
    return q.order_by(models.Deadline.due_date.asc(), models.Deadline.id.asc()).all()


@app.get("/stats/weekly", response_model=list[schemas.WeeklyStat])
def weekly_stats(week_start: date | None = None, db: DbSession = Depends(database.get_db)):
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    totals: dict[int, int] = {}
    sessions = (
        db.query(models.Session)
        .filter(models.Session.date >= week_start, models.Session.date <= week_end)
        .all()
    )
    for sess in sessions:
        totals[sess.subject_id] = totals.get(sess.subject_id, 0) + sess.duration_minutes
    subjects = db.query(models.Subject).order_by(models.Subject.id).all()
    return [
        schemas.WeeklyStat(
            subject_id=sub.id,
            name=sub.name,
            color=sub.color,
            target_hours_per_week=sub.target_hours_per_week,
            minutes=totals.get(sub.id, 0),
        )
        for sub in subjects
    ]


def _get_or_404(db: DbSession, model, item_id: int):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item


def _require_subject(db: DbSession, subject_id: int):
    # SQLite does not enforce foreign keys, so check the subject exists explicitly.
    if db.get(models.Subject, subject_id) is None:
        raise HTTPException(status_code=404, detail="Subject not found")


def _update(db: DbSession, model, item_id: int, data):
    item = _get_or_404(db, model, item_id)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def _delete(db: DbSession, model, item_id: int):
    db.delete(_get_or_404(db, model, item_id))
    db.commit()


@app.put("/subjects/{item_id}", response_model=schemas.SubjectOut)
def update_subject(item_id: int, subject: schemas.SubjectCreate, db: DbSession = Depends(database.get_db)):
    return _update(db, models.Subject, item_id, subject)


@app.delete("/subjects/{item_id}", status_code=204)
def delete_subject(item_id: int, db: DbSession = Depends(database.get_db)):
    _delete(db, models.Subject, item_id)


@app.put("/sessions/{item_id}", response_model=schemas.SessionOut)
def update_session(item_id: int, session: schemas.SessionCreate, db: DbSession = Depends(database.get_db)):
    _require_subject(db, session.subject_id)
    return _update(db, models.Session, item_id, session)


@app.delete("/sessions/{item_id}", status_code=204)
def delete_session(item_id: int, db: DbSession = Depends(database.get_db)):
    _delete(db, models.Session, item_id)


@app.put("/deadlines/{item_id}", response_model=schemas.DeadlineOut)
def update_deadline(item_id: int, deadline: schemas.DeadlineCreate, db: DbSession = Depends(database.get_db)):
    _require_subject(db, deadline.subject_id)
    return _update(db, models.Deadline, item_id, deadline)


@app.delete("/deadlines/{item_id}", status_code=204)
def delete_deadline(item_id: int, db: DbSession = Depends(database.get_db)):
    _delete(db, models.Deadline, item_id)
