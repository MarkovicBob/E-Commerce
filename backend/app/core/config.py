from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    frontend_origin: str = "http://localhost:4200"
    secret_key: str = "dev-secret"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    log_level: str = "INFO"
    admin_email: str = "admin@demo.test"
    admin_password: str = "Admin123!"
    standard_shipping_cost: int = 500
    express_shipping_cost: int = 1200
    rsd_eur_rate: float = 117.2

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
