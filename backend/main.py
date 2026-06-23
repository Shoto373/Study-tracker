from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session as DbSession
import database
import models
import schemas

app = FastAPI()


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