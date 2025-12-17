"""Database models for the Kareta CRM backend."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class Program(Base):
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    duration_months = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)

    students = relationship("Student", back_populates="program", cascade="all,delete")
    leads = relationship("Lead", back_populates="preferred_program")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(120), nullable=False)
    last_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(30), nullable=False)
    status = Column(String(50), nullable=False, default="enrolled")
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    notes = Column(Text, nullable=True)

    program = relationship("Program", back_populates="students")
    lead = relationship("Lead", back_populates="converted_student", uselist=False)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)
    status = Column(String(50), nullable=False, default="new")
    source = Column(String(100), nullable=True)
    preferred_program_id = Column(Integer, ForeignKey("programs.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    converted_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)

    preferred_program = relationship("Program", back_populates="leads")
    converted_student = relationship("Student", back_populates="lead")
