import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# Tests always run against a throwaway SQLite file, never a configured Postgres URL.
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest  # noqa: E402

from app.db.session import Base, engine  # noqa: E402
from app.services.storage import MEDIA_ROOT  # noqa: E402


@pytest.fixture()
def fresh_db():
    """Rebuild the schema so each test starts from an empty database."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_uploaded_media():
    """Delete files an upload test wrote, so runs do not litter the media folder."""
    before = set(MEDIA_ROOT.iterdir()) if MEDIA_ROOT.exists() else set()
    yield
    if not MEDIA_ROOT.exists():
        return
    for path in set(MEDIA_ROOT.iterdir()) - before:
        if path.is_file():
            path.unlink(missing_ok=True)
