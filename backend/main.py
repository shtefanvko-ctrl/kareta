"""FastAPI application powering the Kareta CRM."""
from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kareta CRM", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/programs", response_model=list[schemas.ProgramRead])
def get_programs(db: Session = Depends(get_db)):
    return crud.list_programs(db)


@app.post("/programs", response_model=schemas.ProgramRead, status_code=201)
def create_program(program_in: schemas.ProgramCreate, db: Session = Depends(get_db)):
    return crud.create_program(db, program_in)


@app.put("/programs/{program_id}", response_model=schemas.ProgramRead)
def update_program(program_id: int, program_in: schemas.ProgramUpdate, db: Session = Depends(get_db)):
    program = db.get(models.Program, program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.update_program(db, program, program_in)


@app.delete("/programs/{program_id}", status_code=204)
def delete_program(program_id: int, db: Session = Depends(get_db)):
    program = db.get(models.Program, program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    crud.delete_program(db, program)


@app.get("/students", response_model=list[schemas.StudentRead])
def get_students(db: Session = Depends(get_db)):
    return crud.list_students(db)


@app.post("/students", response_model=schemas.StudentRead, status_code=201)
def create_student(student_in: schemas.StudentCreate, db: Session = Depends(get_db)):
    program = db.get(models.Program, student_in.program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    student = crud.create_student(db, student_in)
    db.refresh(student)
    return student


@app.put("/students/{student_id}", response_model=schemas.StudentRead)
def update_student(student_id: int, student_in: schemas.StudentUpdate, db: Session = Depends(get_db)):
    student = db.get(models.Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student_in.program_id is not None:
        program = db.get(models.Program, student_in.program_id)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
    return crud.update_student(db, student, student_in)


@app.delete("/students/{student_id}", status_code=204)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.get(models.Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    crud.delete_student(db, student)


@app.get("/leads", response_model=list[schemas.LeadRead])
def get_leads(db: Session = Depends(get_db)):
    return crud.list_leads(db)


@app.post("/leads", response_model=schemas.LeadRead, status_code=201)
def create_lead(lead_in: schemas.LeadCreate, db: Session = Depends(get_db)):
    if lead_in.preferred_program_id is not None:
        program = db.get(models.Program, lead_in.preferred_program_id)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
    return crud.create_lead(db, lead_in)


@app.put("/leads/{lead_id}", response_model=schemas.LeadRead)
def update_lead(lead_id: int, lead_in: schemas.LeadUpdate, db: Session = Depends(get_db)):
    lead = db.get(models.Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead_in.preferred_program_id is not None:
        program = db.get(models.Program, lead_in.preferred_program_id)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
    if lead_in.converted_student_id is not None:
        student = db.get(models.Student, lead_in.converted_student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
    return crud.update_lead(db, lead, lead_in)


@app.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(models.Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    crud.delete_lead(db, lead)


@app.post("/leads/{lead_id}/convert", response_model=schemas.StudentRead)
def convert_lead(lead_id: int, student_in: schemas.StudentCreate, db: Session = Depends(get_db)):
    lead = db.get(models.Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.converted_student_id:
        raise HTTPException(status_code=400, detail="Lead already converted")
    program = db.get(models.Program, student_in.program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    student = crud.convert_lead_to_student(db, lead, student_in)
    db.refresh(student)
    return student


@app.get("/dashboard/summary", response_model=schemas.DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return crud.dashboard_summary(db)
