"""CRUD helper functions for the Kareta CRM backend."""
from __future__ import annotations

from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas


# Program helpers -----------------------------------------------------------

def list_programs(db: Session) -> Iterable[models.Program]:
    return db.query(models.Program).order_by(models.Program.name).all()


def create_program(db: Session, program_in: schemas.ProgramCreate) -> models.Program:
    program = models.Program(**program_in.dict())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def update_program(
    db: Session, program: models.Program, program_in: schemas.ProgramUpdate
) -> models.Program:
    for field, value in program_in.dict(exclude_unset=True).items():
        setattr(program, field, value)
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def delete_program(db: Session, program: models.Program) -> None:
    db.delete(program)
    db.commit()


# Student helpers -----------------------------------------------------------

def list_students(db: Session) -> Iterable[models.Student]:
    return db.query(models.Student).order_by(models.Student.last_name).all()


def create_student(
    db: Session, student_in: schemas.StudentCreate, *, commit: bool = True
) -> models.Student:
    student = models.Student(**student_in.dict())
    db.add(student)
    if commit:
        db.commit()
        db.refresh(student)
    else:
        db.flush()
    return student


def update_student(
    db: Session, student: models.Student, student_in: schemas.StudentUpdate
) -> models.Student:
    for field, value in student_in.dict(exclude_unset=True).items():
        setattr(student, field, value)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def delete_student(db: Session, student: models.Student) -> None:
    db.delete(student)
    db.commit()


# Lead helpers --------------------------------------------------------------

def list_leads(db: Session) -> Iterable[models.Lead]:
    return db.query(models.Lead).order_by(models.Lead.created_at.desc()).all()


def create_lead(db: Session, lead_in: schemas.LeadCreate) -> models.Lead:
    lead = models.Lead(**lead_in.dict())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def update_lead(
    db: Session, lead: models.Lead, lead_in: schemas.LeadUpdate
) -> models.Lead:
    for field, value in lead_in.dict(exclude_unset=True).items():
        setattr(lead, field, value)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def delete_lead(db: Session, lead: models.Lead) -> None:
    db.delete(lead)
    db.commit()


def dashboard_summary(db: Session) -> schemas.DashboardSummary:
    programs = db.query(func.count(models.Program.id)).scalar() or 0
    students = db.query(func.count(models.Student.id)).scalar() or 0
    leads = db.query(func.count(models.Lead.id)).scalar() or 0
    new_leads = (
        db.query(func.count(models.Lead.id))
        .filter(models.Lead.status == "new")
        .scalar()
        or 0
    )
    converted_leads = (
        db.query(func.count(models.Lead.id))
        .filter(models.Lead.converted_student_id.isnot(None))
        .scalar()
        or 0
    )

    return schemas.DashboardSummary(
        programs=programs,
        students=students,
        leads=leads,
        new_leads=new_leads,
        converted_leads=converted_leads,
    )


def convert_lead_to_student(
    db: Session,
    lead: models.Lead,
    student_in: schemas.StudentCreate,
) -> models.Student:
    student = create_student(db, student_in, commit=False)
    lead.status = "converted"
    lead.converted_student_id = student.id
    db.add(lead)
    db.commit()
    db.refresh(student)
    db.refresh(lead)
    return student
