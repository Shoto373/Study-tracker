from fastapi import FastAPI, Depends
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
