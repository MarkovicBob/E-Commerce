import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.services.storage import MEDIA_ROOT

configure_logging()
logger = logging.getLogger(__name__)
settings.verify()

app = FastAPI(title="Luxe Commerce API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # A comma-separated FRONTEND_ORIGIN lets one API serve several front ends.
    allow_origins=[origin.strip() for origin in settings.frontend_origin.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Keep the documented {"detail": ...} error shape for unexpected failures too.

    Starlette's default 500 is plain text, which would break clients that always
    parse JSON. The cause is logged; the response deliberately says nothing about it.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# StaticFiles refuses to mount a missing directory, which would stop the API from
# booting on a fresh checkout where nothing has been uploaded yet.
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok"}
