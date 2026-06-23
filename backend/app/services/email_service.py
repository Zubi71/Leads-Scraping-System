"""
Email outreach service via SMTP.
Supports both system-level SMTP config and per-user override credentials.
"""

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional, Dict, Any
from app.config import settings
import structlog

logger = structlog.get_logger()


class SMTPCredentials:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
        from_name: str,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email
        self.from_name = from_name

    @classmethod
    def from_settings(cls) -> "SMTPCredentials":
        return cls(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            from_email=settings.FROM_EMAIL,
            from_name=settings.FROM_NAME,
        )

    @classmethod
    def from_user_settings(cls, user_settings) -> "SMTPCredentials":
        return cls(
            host=user_settings.smtp_host or settings.SMTP_HOST,
            port=user_settings.smtp_port or settings.SMTP_PORT,
            username=user_settings.smtp_username or settings.SMTP_USERNAME,
            password=user_settings.smtp_password or settings.SMTP_PASSWORD,
            from_email=user_settings.from_email or settings.FROM_EMAIL,
            from_name=user_settings.from_name or settings.FROM_NAME,
        )


class EmailService:

    async def send(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        credentials: Optional[SMTPCredentials] = None,
        reply_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        creds = credentials or SMTPCredentials.from_settings()

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((creds.from_name, creds.from_email))
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            msg.attach(MIMEText(body_html, "html", "utf-8"))
        else:
            # Auto-generate basic HTML
            html = f"<html><body><p>{body_text.replace(chr(10), '<br>')}</p></body></html>"
            msg.attach(MIMEText(html, "html", "utf-8"))

        try:
            await aiosmtplib.send(
                msg,
                hostname=creds.host,
                port=creds.port,
                username=creds.username,
                password=creds.password,
                start_tls=True,
            )
            logger.info("Email sent", to=to_email, subject=subject)
            return {"status": "sent", "to": to_email}
        except Exception as e:
            logger.error("Email send failed", to=to_email, error=str(e))
            raise EmailError(f"Failed to send email: {str(e)}")

    async def send_bulk(
        self,
        recipients: list[Dict],
        credentials: Optional[SMTPCredentials] = None,
    ) -> list[Dict]:
        """
        recipients: list of {to_email, subject, body_text, body_html?}
        Returns list of results.
        """
        results = []
        for recipient in recipients:
            try:
                result = await self.send(
                    to_email=recipient["to_email"],
                    subject=recipient["subject"],
                    body_text=recipient["body_text"],
                    body_html=recipient.get("body_html"),
                    credentials=credentials,
                )
                results.append({"email": recipient["to_email"], **result})
            except Exception as e:
                results.append({"email": recipient["to_email"], "status": "failed", "error": str(e)})
        return results


class EmailError(Exception):
    pass


email_service = EmailService()
