from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import NewsletterSubscriber

router = APIRouter()


class SubscribeIn(BaseModel):
    email: EmailStr


@router.post("/subscribe")
def subscribe(payload: SubscribeIn, db: Session = Depends(get_db)):
    subscriber = db.query(NewsletterSubscriber).filter_by(email=payload.email).first()
    if subscriber:
        subscriber.is_active = True
    else:
        db.add(NewsletterSubscriber(email=payload.email))
    db.commit()
    return {"detail": "Subscribed"}
