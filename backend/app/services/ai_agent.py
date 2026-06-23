"""
AI Conversation Agent — powered by OpenRouter.
Supports any model on OpenRouter including free ones (Gemini, Llama, etc.)
OpenRouter uses the OpenAI-compatible API format.
"""

import json
from typing import Optional, List, Dict, Any
from openai import OpenAI
from app.config import settings
import structlog

logger = structlog.get_logger()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

DEFAULT_SYSTEM_PROMPT = """You are a professional sales agent for a web development agency.
Your job is to contact local businesses that don't have a website (or have a poor one),
and persuade them to get a professional website built.

Guidelines:
- Be friendly, professional, and conversational — never robotic
- Keep messages SHORT (2-4 sentences for WhatsApp, short paragraphs for email)
- Personalize every message using the business name and their specific situation
- Handle objections with empathy, not pressure
- Never lie about pricing — stay within the agreed price range
- If the prospect is clearly not interested, politely accept and end the conversation
- When a prospect confirms interest, ask for their preferred contact time and email
- Use the local language if specified

Compliance:
- Always offer an easy opt-out ("Reply STOP to unsubscribe")
- Never spam — if they say stop, stop immediately
"""

PROPOSAL_WHATSAPP_TEMPLATE = """Generate a WhatsApp cold outreach message for this business:

Business Name: {business_name}
Niche: {niche}
Location: {city}, {country}
Rating: {rating} ({reviews} reviews)
Website Status: {website_status}
Our Package: {package_name} at {currency}{price}

Requirements:
- Max 3 sentences
- Sound fully human and genuine, not salesy
- Mention their specific situation (no website / poor website)
- Include a soft call to action
- Include opt-out line at the end
- Language: {language}
"""

PROPOSAL_EMAIL_TEMPLATE = """Generate a cold outreach email for this business:

Business Name: {business_name}
Niche: {niche}
Location: {city}, {country}
Rating: {rating} ({reviews} reviews)
Website Status: {website_status}
Our Package: {package_name} at {currency}{price}

Requirements:
- Subject line: catchy, personalized, max 8 words
- Body: 3-4 short paragraphs
- Professional but warm tone
- Value-focused (more customers, online presence)
- Clear CTA at the end
- Unsubscribe link mention
- Language: {language}

Format response as JSON: {{"subject": "...", "body": "..."}}
"""

CONVERSATION_SYSTEM = """You are a sales agent handling WhatsApp/email replies from a local business owner.

Context about this lead:
{context}

Your goals:
1. Understand what they're saying
2. Respond naturally and helpfully
3. Handle any objections warmly
4. Move toward booking a call or confirming the deal
5. If they ask a question you don't know, say you'll check and get back to them

Constraints:
- Keep replies SHORT (2-4 sentences for WhatsApp)
- Never push too hard — be conversational
- If they say they're not interested, respect that and close politely
- When they confirm interest, output a JSON marker at the end: [DEAL_CONFIRMED]
- When they ask to stop, output: [OPT_OUT]
- Language: {language}
"""


def _get_client() -> OpenAI:
    """Return an OpenAI-compatible client pointing to OpenRouter."""
    api_key = settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("No AI API key configured. Set OPENROUTER_API_KEY in .env")

    base_url = OPENROUTER_BASE_URL if settings.OPENROUTER_API_KEY else None

    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Leads System",
        } if settings.OPENROUTER_API_KEY else {},
    )


class AIAgentService:

    def _call(self, system: str, messages: List[Dict], max_tokens: int = 500) -> str:
        client = _get_client()
        full_messages = [{"role": "system", "content": system}] + messages
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=full_messages,
            max_tokens=max_tokens,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""

    def generate_whatsapp_proposal(
        self,
        business_name: str,
        niche: str,
        city: str,
        country: str,
        rating: Optional[float],
        reviews: int,
        website_status: str,
        package_name: str,
        price: float,
        currency: str = "USD",
        language: str = "English",
        custom_template: Optional[str] = None,
    ) -> str:
        template = custom_template or PROPOSAL_WHATSAPP_TEMPLATE
        prompt = template.format(
            business_name=business_name, niche=niche, city=city, country=country,
            rating=rating or "N/A", reviews=reviews, website_status=website_status,
            package_name=package_name, price=price, currency=currency, language=language,
        )
        return self._call(DEFAULT_SYSTEM_PROMPT, [{"role": "user", "content": prompt}], max_tokens=300)

    def generate_email_proposal(
        self,
        business_name: str,
        niche: str,
        city: str,
        country: str,
        rating: Optional[float],
        reviews: int,
        website_status: str,
        package_name: str,
        price: float,
        currency: str = "USD",
        language: str = "English",
        custom_template: Optional[str] = None,
    ) -> Dict[str, str]:
        template = custom_template or PROPOSAL_EMAIL_TEMPLATE
        prompt = template.format(
            business_name=business_name, niche=niche, city=city, country=country,
            rating=rating or "N/A", reviews=reviews, website_status=website_status,
            package_name=package_name, price=price, currency=currency, language=language,
        )
        raw = self._call(DEFAULT_SYSTEM_PROMPT, [{"role": "user", "content": prompt}], max_tokens=600)
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            return json.loads(raw[start:end])
        except Exception:
            return {"subject": f"Website for {business_name}", "body": raw}

    def generate_reply(
        self,
        conversation_history: List[Dict],
        lead_context: str,
        language: str = "English",
        custom_system: Optional[str] = None,
    ) -> Dict[str, Any]:
        system = (custom_system or CONVERSATION_SYSTEM).format(
            context=lead_context, language=language,
        )
        response_text = self._call(system, conversation_history, max_tokens=400)

        deal_confirmed = "[DEAL_CONFIRMED]" in response_text
        opt_out = "[OPT_OUT]" in response_text
        clean_message = response_text.replace("[DEAL_CONFIRMED]", "").replace("[OPT_OUT]", "").strip()

        intent_score = 50
        positive = ["interested", "yes", "sure", "when", "how much", "proceed", "let's do", "ok", "sounds good"]
        negative = ["not interested", "no thanks", "stop", "don't want", "too expensive"]
        lower = clean_message.lower()
        if any(s in lower for s in positive):
            intent_score = 80
        if any(s in lower for s in negative):
            intent_score = 10
        if deal_confirmed:
            intent_score = 100

        return {
            "message": clean_message,
            "deal_confirmed": deal_confirmed,
            "opt_out": opt_out,
            "intent_score": intent_score,
        }

    def generate_follow_up(
        self,
        business_name: str,
        follow_up_number: int,
        original_message: str,
        language: str = "English",
    ) -> str:
        prompt = (
            f"Write follow-up #{follow_up_number} for {business_name} "
            f"who hasn't responded to our website proposal. "
            f"Original message: {original_message[:200]}... "
            f"Keep it short (2 sentences), friendly, add slight urgency. Language: {language}"
        )
        return self._call(DEFAULT_SYSTEM_PROMPT, [{"role": "user", "content": prompt}], max_tokens=150)


ai_agent = AIAgentService()
