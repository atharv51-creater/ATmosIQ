import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent.parent / "data")))
    cors_origins: list = field(default_factory=lambda: [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()])
    regions: tuple = ("pune",)
    default_weights: dict = field(default_factory=lambda: {"hazard": 0.5, "exposure": 0.3, "vulnerability": 0.2})
    telegram_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_chat: str = os.getenv("TELEGRAM_CHAT_ID", "")
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    email_from: str = os.getenv("ALERT_EMAIL_FROM", "")
    email_to: str = os.getenv("ALERT_EMAIL_TO", "")
