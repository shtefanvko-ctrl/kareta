"""Pydantic schemas for the Kareta CRM backend."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ProgramBase(BaseModel):
    name: str = Field(..., max_length=120)
    duration_months: int = Field(..., ge=1, le=60)
    description: str


class ProgramCreate(ProgramBase):
    pass


class ProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    duration_months: Optional[int] = Field(None, ge=1, le=60)
    description: Optional[str]


class ProgramRead(ProgramBase):
    id: int

    class Config:
        orm_mode = True


class StudentBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    status: str = Field(default="enrolled")
    program_id: int
    notes: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    status: Optional[str]
    program_id: Optional[int]
    notes: Optional[str]


class StudentRead(StudentBase):
    id: int
    program: ProgramRead

    class Config:
        orm_mode = True


class LeadBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    status: str = Field(default="new")
    source: Optional[str] = None
    preferred_program_id: Optional[int] = None
    notes: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    status: Optional[str]
    source: Optional[str]
    preferred_program_id: Optional[int]
    notes: Optional[str]
    converted_student_id: Optional[int]


class LeadRead(LeadBase):
    id: int
    created_at: datetime
    converted_student_id: Optional[int]

    class Config:
        orm_mode = True


class DashboardSummary(BaseModel):
    programs: int
    students: int
    leads: int
    new_leads: int
    converted_leads: int
