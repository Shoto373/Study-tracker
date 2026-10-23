import math
from datetime import date, timedelta

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DbSession
import database
import models
import schemas
import scraper

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def current_owner(request: Request, db: DbSession = Depends(database.get_db)) -> str:
    """Client IP; behind nginx it arrives in X-Real-IP."""
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")
    # Subjects created before ownership existed go to the first client that shows up.
    if db.query(models.Subject).filter(models.Subject.owner == "").update({"owner": ip}):
        db.commit()
    return ip


@app.get("/")
def read_root():
    return {"message": "Study Tracker API is running"}

@app.post("/subjects/", response_model=schemas.SubjectOut)
def create_subject(
    subject: schemas.SubjectCreate,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    db_subject = models.Subject(**subject.model_dump(), owner=owner)
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    return db_subject


@app.get("/subjects/", response_model=list[schemas.SubjectOut])
def list_subjects(db: DbSession = Depends(database.get_db), owner: str = Depends(current_owner)):
    return db.query(models.Subject).filter(models.Subject.owner == owner).all()

@app.post("/sessions/", response_model=schemas.SessionOut)
def create_session(
    session: schemas.SessionCreate,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    _require_subject(db, session.subject_id, owner)
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
    owner: str = Depends(current_owner),
):
    q = db.query(models.Session).join(models.Subject).filter(models.Subject.owner == owner)
    if subject_id is not None:
        q = q.filter(models.Session.subject_id == subject_id)
    if date_from is not None:
        q = q.filter(models.Session.date >= date_from)
    if date_to is not None:
        q = q.filter(models.Session.date <= date_to)
    return q.order_by(models.Session.date.desc(), models.Session.id.desc()).all()


@app.post("/deadlines/", response_model=schemas.DeadlineOut)
def create_deadline(
    deadline: schemas.DeadlineCreate,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    _require_subject(db, deadline.subject_id, owner)
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
    owner: str = Depends(current_owner),
):
    q = db.query(models.Deadline).join(models.Subject).filter(models.Subject.owner == owner)
    if subject_id is not None:
        q = q.filter(models.Deadline.subject_id == subject_id)
    if is_done is not None:
        q = q.filter(models.Deadline.is_done == is_done)
    if due_before is not None:
        q = q.filter(models.Deadline.due_date < due_before)
    return q.order_by(models.Deadline.due_date.asc(), models.Deadline.id.asc()).all()


@app.get("/stats/weekly", response_model=list[schemas.WeeklyStat])
def weekly_stats(
    week_start: date | None = None,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    totals: dict[int, int] = {}
    sessions = (
        db.query(models.Session)
        .join(models.Subject)
        .filter(models.Subject.owner == owner)
        .filter(models.Session.date >= week_start, models.Session.date <= week_end)
        .all()
    )
    for sess in sessions:
        totals[sess.subject_id] = totals.get(sess.subject_id, 0) + sess.duration_minutes
    subjects = (
        db.query(models.Subject).filter(models.Subject.owner == owner).order_by(models.Subject.id).all()
    )
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


def _forget_dismissed(db: DbSession, owner: str):
    db.query(models.DismissedSubject).filter(models.DismissedSubject.owner == owner).delete()


def _item_owner(item) -> str:
    return item.owner if isinstance(item, models.Subject) else item.subject.owner


def _get_or_404(db: DbSession, model, item_id: int, owner: str):
    item = db.get(model, item_id)
    # Someone else's record looks the same as a missing one.
    if item is None or _item_owner(item) != owner:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item


def _require_subject(db: DbSession, subject_id: int, owner: str):
    # SQLite does not enforce foreign keys, so check the subject exists explicitly.
    _get_or_404(db, models.Subject, subject_id, owner)


def _update(db: DbSession, model, item_id: int, data, owner: str):
    item = _get_or_404(db, model, item_id, owner)
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def _delete(db: DbSession, model, item_id: int, owner: str):
    db.delete(_get_or_404(db, model, item_id, owner))
    db.commit()


@app.delete("/subjects/", status_code=204)
def delete_all_subjects(db: DbSession = Depends(database.get_db), owner: str = Depends(current_owner)):
    """Remove all of the owner's subjects (with sessions and deadlines) and unpin the group.

    The group is unpinned too, otherwise the next visit would import its subjects again.
    """
    for subject in db.query(models.Subject).filter(models.Subject.owner == owner).all():
        db.delete(subject)
    pinned = db.get(models.UserGroup, owner)
    if pinned is not None:
        db.delete(pinned)
    _forget_dismissed(db, owner)
    db.commit()


@app.put("/subjects/{item_id}", response_model=schemas.SubjectOut)
def update_subject(
    item_id: int,
    subject: schemas.SubjectCreate,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    return _update(db, models.Subject, item_id, subject, owner)


@app.delete("/subjects/{item_id}", status_code=204)
def delete_subject(item_id: int, db: DbSession = Depends(database.get_db), owner: str = Depends(current_owner)):
    subject = _get_or_404(db, models.Subject, item_id, owner)
    if subject.source:
        # Imported subject: remember the removal so the next import does not restore it.
        db.add(models.DismissedSubject(owner=owner, name=subject.source.casefold()))
    db.delete(subject)
    db.commit()


@app.put("/sessions/{item_id}", response_model=schemas.SessionOut)
def update_session(
    item_id: int,
    session: schemas.SessionCreate,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    _require_subject(db, session.subject_id, owner)
    return _update(db, models.Session, item_id, session, owner)


@app.delete("/sessions/{item_id}", status_code=204)
def delete_session(item_id: int, db: DbSession = Depends(database.get_db), owner: str = Depends(current_owner)):
    _delete(db, models.Session, item_id, owner)


@app.put("/deadlines/{item_id}", response_model=schemas.DeadlineOut)
def update_deadline(
    item_id: int,
    deadline: schemas.DeadlineCreate,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    _require_subject(db, deadline.subject_id, owner)
    return _update(db, models.Deadline, item_id, deadline, owner)


@app.delete("/deadlines/{item_id}", status_code=204)
def delete_deadline(item_id: int, db: DbSession = Depends(database.get_db), owner: str = Depends(current_owner)):
    _delete(db, models.Deadline, item_id, owner)


# Distinct colors handed out to subjects imported from the timetable.
_PALETTE = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"]


def _timetable(call, *args):
    try:
        return call(*args)
    except scraper.ScheduleUnavailable:
        raise HTTPException(status_code=502, detail="Timetable site is unavailable")


@app.get("/schedule/faculties")
def schedule_faculties():
    return scraper.parse_faculties(_timetable(scraper.fetch_options, 4))


@app.get("/schedule/groups")
def schedule_groups(faculty: int):
    return scraper.parse_groups(_timetable(scraper.fetch_options, faculty))


@app.get("/schedule/me", response_model=schemas.ScheduleGroup | None)
def my_group(db: DbSession = Depends(database.get_db), owner: str = Depends(current_owner)):
    pinned = db.get(models.UserGroup, owner)
    if pinned is None:
        return None
    return {"faculty": pinned.faculty, "group": pinned.group_id, "group_name": pinned.group_name}


@app.post("/schedule/import", response_model=schemas.ScheduleImportResult)
def import_schedule(
    data: schemas.ScheduleImport,
    db: DbSession = Depends(database.get_db),
    owner: str = Depends(current_owner),
):
    pinned = db.get(models.UserGroup, owner)
    changing = pinned is not None and (pinned.faculty, pinned.group_id) != (data.faculty, data.group)

    if changing and not data.confirm:
        sessions = (
            db.query(models.Session).join(models.Subject).filter(models.Subject.owner == owner).all()
        )
        if sessions:
            # Do not wipe recorded work without the user's explicit agreement.
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "has_activity",
                    "sessions": len(sessions),
                    "minutes": sum(s.duration_minutes for s in sessions),
                },
            )

    # Fetch first: if the timetable site is down, nothing has been deleted yet.
    lessons = _timetable(scraper.fetch_subjects, data.faculty, data.group)

    if changing:
        for subject in db.query(models.Subject).filter(models.Subject.owner == owner).all():
            db.delete(subject)  # sessions and deadlines go with it
        _forget_dismissed(db, owner)
        db.flush()

    own = db.query(models.Subject).filter(models.Subject.owner == owner).all()
    # Present already, under its own or (after a rename) its timetable name.
    known = {s.name.casefold() for s in own} | {s.source.casefold() for s in own if s.source}
    dismissed = {
        d.name for d in db.query(models.DismissedSubject).filter(models.DismissedSubject.owner == owner)
    }
    created, existing = [], []
    for lesson in lessons:
        key = lesson["name"].casefold()
        if key in dismissed:
            continue
        if key in known:
            existing.append(lesson["name"])
            continue
        subject = models.Subject(
            name=lesson["name"][:100],
            color=_PALETTE[(len(known) + len(created)) % len(_PALETTE)],
            # A lesson is 1.5 hours; `lessons` is the weekly average. Round up to whole hours.
            target_hours_per_week=math.ceil(round(lesson["lessons"] * 1.5, 4)),
            owner=owner,
            source=lesson["name"],
        )
        db.add(subject)
        created.append(subject)

    if pinned is None:
        db.add(models.UserGroup(ip=owner, faculty=data.faculty, group_id=data.group, group_name=data.group_name))
    else:
        pinned.faculty, pinned.group_id, pinned.group_name = data.faculty, data.group, data.group_name
    db.commit()
    for subject in created:
        db.refresh(subject)
    return {"created": created, "existing": existing, "replaced": changing}
