import smtplib
from email.message import EmailMessage
import requests


def send_telegram(token, chat_id, text):
    r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                      json={"chat_id": chat_id, "text": text[:4000]}, timeout=15)
    r.raise_for_status()
    return r.json().get("ok", False)


def send_email(cfg, subject, text):
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, cfg.email_from, cfg.email_to
    msg.set_content(text)
    with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=20) as s:
        s.starttls()
        if cfg.smtp_user:
            s.login(cfg.smtp_user, cfg.smtp_password)
        s.send_message(msg)
    return True
