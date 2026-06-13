from pydantic import BaseModel


class Page(BaseModel):
    items: list
    total: int
    page: int = 1
    page_size: int = 12


class Message(BaseModel):
    detail: str
