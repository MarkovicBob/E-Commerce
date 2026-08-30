import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Values shipped in the repo. Anyone can read them, so anyone could forge an admin
# token against a deployment that kept one.
PLACEHOLDER_SECRETS = {"dev-secret", "change-me-in-production", "secret", "changeme"}


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    frontend_origin: str = "http://localhost:4200"
    # Public base of this API. Uploaded images are stored as relative paths and
    # served with this prefix, because the SPA runs on a different origin and
    # would otherwise resolve "/media/..." against itself.
    api_public_url: str = "http://localhost:8000"
    secret_key: str = "dev-secret"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    log_level: str = "INFO"
    admin_email: str = "admin@luxecommerce.com"
    admin_password: str = "Admin123!"
    standard_shipping_cost: int = 500
    express_shipping_cost: int = 1200
    # Official NBS middle rates from 2026-08-28. Prices are stored in RSD and
    # converted for display only; checkout accounting remains in RSD.
    rsd_eur_rate: float = 117.3707
    rsd_usd_rate: float = 100.7906
    # No mailer is wired up yet: turn this on in local dev to get the reset token
    # back in the API response. Must stay False in production.
    expose_reset_token: bool = False
    # Send auth cookies with Secure; requires HTTPS, so off by default for local dev.
    cookie_secure: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def uses_placeholder_secret(self) -> bool:
        return self.secret_key in PLACEHOLDER_SECRETS

    def verify(self) -> None:
        """
        Fail fast on a configuration that is unsafe to serve.

        `cookie_secure` is the marker that the deployment is behind HTTPS, i.e.
        no longer a local demo, so the shipped defaults must be gone by then.
        """
        if not self.uses_placeholder_secret and not self.expose_reset_token:
            return

        if self.cookie_secure:
            problems = []
            if self.uses_placeholder_secret:
                problems.append("SECRET_KEY is still the example value; JWTs could be forged")
            if self.expose_reset_token:
                problems.append("EXPOSE_RESET_TOKEN must be false outside local development")
            raise RuntimeError("Refusing to start: " + "; ".join(problems))

        if self.uses_placeholder_secret:
            logger.warning(
                "SECRET_KEY is the example value from the repository. Fine for a local demo, "
                "but set a real random SECRET_KEY before exposing this API to anyone else."
            )
        if self.expose_reset_token:
            logger.warning("EXPOSE_RESET_TOKEN is on: password-reset tokens are returned in API responses.")


settings = Settings()
