from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DbSession
import database
import models
import schemas

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
    db_session = models.Session(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@app.get("/sessions/", response_model=list[schemas.SessionOut])
def list_sessions(db: DbSession = Depends(database.get_db)):
    return db.query(models.Session).all()


@app.post("/deadlines/", response_model=schemas.DeadlineOut)
def create_deadline(deadline: schemas.DeadlineCreate, db: DbSession = Depends(database.get_db)):
    db_deadline = models.Deadline(**deadline.model_dump())
    db.add(db_deadline)
    db.commit()
    db.refresh(db_deadline)
    return db_deadline


@app.get("/deadlines/", response_model=list[schemas.DeadlineOut])
def list_deadlines(db: DbSession = Depends(database.get_db)):
    return db.query(models.Deadline).all()


def _get_or_404(db: DbSession, model, item_id: int):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item


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
    return _update(db, models.Session, item_id, session)


@app.delete("/sessions/{item_id}", status_code=204)
def delete_session(item_id: int, db: DbSession = Depends(database.get_db)):
    _delete(db, models.Session, item_id)


@app.put("/deadlines/{item_id}", response_model=schemas.DeadlineOut)
def update_deadline(item_id: int, deadline: schemas.DeadlineCreate, db: DbSession = Depends(database.get_db)):
    return _update(db, models.Deadline, item_id, deadline)


@app.delete("/deadlines/{item_id}", status_code=204)
def delete_deadline(item_id: int, db: DbSession = Depends(database.get_db)):
    _delete(db, models.Deadline, item_id)
