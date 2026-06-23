"""
Real-time notification service.
Sends WhatsApp alerts to the operator (you) on key events.
"""

from typing import Optional
from app.services.whatsapp import whatsapp_service
from app.config import settings
import structlog

logger = structlog.get_logger()


class NotificationService:

    async def notify_new_reply(
        self,
        business_name: str,
        message_preview: str,
        lead_id: int,
        to: Optional[str] = None,
    ) -> None:
        number = to or settings.MY_WHATSAPP_NUMBER
        if not number:
            return
        text = (
            f"📩 *New Reply Received*\n\n"
            f"Business: {business_name}\n"
            f"Preview: {message_preview[:100]}...\n\n"
            f"Lead ID: #{lead_id}\n"
            f"Open dashboard to view full conversation."
        )
        await self._send(number, text)

    async def notify_hot_lead(
        self,
        business_name: str,
        intent_score: int,
        lead_id: int,
        to: Optional[str] = None,
    ) -> None:
        number = to or settings.MY_WHATSAPP_NUMBER
        if not number:
            return
        text = (
            f"🔥 *High-Intent Lead Detected!*\n\n"
            f"Business: {business_name}\n"
            f"Intent Score: {intent_score}/100\n\n"
            f"Lead ID: #{lead_id}\n"
            f"Consider taking over the conversation manually."
        )
        await self._send(number, text)

    async def notify_deal_closed(
        self,
        client_name: str,
        business_name: str,
        phone: Optional[str],
        package: Optional[str],
        price: Optional[float],
        deal_id: int,
        to: Optional[str] = None,
    ) -> None:
        number = to or settings.MY_WHATSAPP_NUMBER
        if not number:
            return
        text = (
            f"🎉 *DEAL CLOSED!*\n\n"
            f"Client: {client_name}\n"
            f"Business: {business_name}\n"
            f"Phone: {phone or 'N/A'}\n"
            f"Package: {package or 'N/A'}\n"
            f"Price: {'$' + str(price) if price else 'N/A'}\n\n"
            f"Deal ID: #{deal_id}\n"
            f"Time to build their website! 🚀"
        )
        await self._send(number, text)

    async def notify_manual_intervention_needed(
        self,
        business_name: str,
        reason: str,
        lead_id: int,
        to: Optional[str] = None,
    ) -> None:
        number = to or settings.MY_WHATSAPP_NUMBER
        if not number:
            return
        text = (
            f"⚠️ *Manual Intervention Needed*\n\n"
            f"Business: {business_name}\n"
            f"Reason: {reason}\n\n"
            f"Lead ID: #{lead_id}"
        )
        await self._send(number, text)

    async def _send(self, number: str, text: str) -> None:
        try:
            await whatsapp_service.send_text(number, text)
        except Exception as e:
            logger.error("Notification send failed", error=str(e))


notification_service = NotificationService()
