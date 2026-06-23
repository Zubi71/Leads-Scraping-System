"""
WhatsApp Business Cloud API integration (Meta).
Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
"""

import httpx
from typing import Optional, Dict, Any
from app.config import settings
import structlog

logger = structlog.get_logger()


class WhatsAppService:

    def __init__(self):
        self._base_url = settings.WHATSAPP_API_URL
        self._token = settings.WHATSAPP_API_TOKEN
        self._phone_id = settings.WHATSAPP_PHONE_ID

    @property
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    @property
    def _messages_url(self) -> str:
        return f"{self._base_url}/{self._phone_id}/messages"

    async def send_text(
        self,
        to: str,
        message: str,
        preview_url: bool = False,
    ) -> Dict[str, Any]:
        """Send a plain text message."""
        # Ensure E.164 format (remove spaces, dashes etc.)
        to = to.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not to.startswith("+"):
            to = "+" + to

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": message,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(self._messages_url, json=payload, headers=self._headers)
            data = resp.json()

            if resp.status_code != 200:
                logger.error("WhatsApp send failed", status=resp.status_code, response=data, to=to)
                raise WhatsAppError(f"Send failed: {data.get('error', {}).get('message', 'Unknown error')}")

            message_id = data.get("messages", [{}])[0].get("id")
            logger.info("WhatsApp message sent", to=to, message_id=message_id)
            return {"message_id": message_id, "status": "sent"}

    async def send_template(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[list] = None,
    ) -> Dict[str, Any]:
        """Send a pre-approved template message."""
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or [],
            },
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(self._messages_url, json=payload, headers=self._headers)
            data = resp.json()
            if resp.status_code != 200:
                raise WhatsAppError(f"Template send failed: {data}")
            return {"message_id": data.get("messages", [{}])[0].get("id"), "status": "sent"}

    async def mark_as_read(self, message_id: str) -> None:
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(self._messages_url, json=payload, headers=self._headers)

    def parse_incoming_webhook(self, payload: Dict) -> Optional[Dict]:
        """Parse Meta webhook payload and return normalised message dict."""
        try:
            entry = payload["entry"][0]
            changes = entry["changes"][0]
            value = changes["value"]

            if "messages" not in value:
                return None

            msg = value["messages"][0]
            contact = value["contacts"][0]

            return {
                "from": msg["from"],
                "name": contact["profile"]["name"],
                "message_id": msg["id"],
                "type": msg["type"],
                "text": msg.get("text", {}).get("body", ""),
                "timestamp": msg["timestamp"],
            }
        except (KeyError, IndexError):
            return None


class WhatsAppError(Exception):
    pass


whatsapp_service = WhatsAppService()
