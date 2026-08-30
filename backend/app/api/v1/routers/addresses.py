from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import current_user
from app.db.session import get_db
from app.models import Address, User

router = APIRouter()


class AddressIn(BaseModel):
    label: str | None = None
    full_name: str = Field(min_length=2, max_length=255)
    street: str = Field(min_length=2, max_length=255)
    city: str = Field(min_length=1, max_length=120)
    postal_code: str = Field(min_length=1, max_length=30)
    country: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=4, max_length=50)
    is_default: bool = False


def out(address: Address) -> dict:
    return {
        "id": address.id,
        "label": address.label,
        "full_name": address.full_name,
        "street": address.street,
        "city": address.city,
        "postal_code": address.postal_code,
        "country": address.country,
        "phone": address.phone,
        "is_default": address.is_default,
    }


def owned(db: Session, address_id: int, user: User) -> Address:
    address = db.get(Address, address_id)
    if not address or address.user_id != user.id:
        raise HTTPException(404, "Address not found")
    return address


def clear_other_defaults(db: Session, user: User, keep_id: int | None) -> None:
    """Exactly one address may be the default, so drop the flag from the rest."""
    query = db.query(Address).filter(Address.user_id == user.id, Address.is_default.is_(True))
    if keep_id is not None:
        query = query.filter(Address.id != keep_id)
    for other in query.all():
        other.is_default = False


@router.get("")
def list_addresses(user: User = Depends(current_user), db: Session = Depends(get_db)):
    items = db.query(Address).filter_by(user_id=user.id).order_by(Address.is_default.desc(), Address.id.asc()).all()
    return [out(item) for item in items]


@router.post("", status_code=201)
def create_address(payload: AddressIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    address = Address(user_id=user.id, **payload.model_dump())
    # The very first address is the default whether or not the form asked for it.
    if not db.query(Address).filter_by(user_id=user.id).count():
        address.is_default = True
    db.add(address)
    db.flush()
    if address.is_default:
        clear_other_defaults(db, user, address.id)
    db.commit()
    db.refresh(address)
    return out(address)


@router.put("/{address_id}")
def update_address(address_id: int, payload: AddressIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    address = owned(db, address_id, user)
    for key, value in payload.model_dump().items():
        setattr(address, key, value)
    if address.is_default:
        clear_other_defaults(db, user, address.id)
    db.commit()
    db.refresh(address)
    return out(address)


@router.put("/{address_id}/default")
def make_default(address_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    address = owned(db, address_id, user)
    clear_other_defaults(db, user, address.id)
    address.is_default = True
    db.commit()
    db.refresh(address)
    return out(address)


@router.delete("/{address_id}")
def delete_address(address_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    address = owned(db, address_id, user)
    was_default = address.is_default
    db.delete(address)
    db.flush()
    if was_default:
        # Promote another address so checkout still has something preselected.
        replacement = db.query(Address).filter_by(user_id=user.id).order_by(Address.id.asc()).first()
        if replacement:
            replacement.is_default = True
    db.commit()
    return {"detail": "Address deleted"}
