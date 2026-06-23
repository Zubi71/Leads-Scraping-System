"""
Website quality analyser.

Checks if a business has a website, and rates its quality.
Scores: 0 = no website, 1-40 = poor, 41-70 = outdated/basic, 71-100 = good.
"""

import asyncio
from typing import Optional, Dict, Any
import httpx
from playwright.async_api import async_playwright
from app.models.lead import WebsiteQuality
import structlog

logger = structlog.get_logger()

MOBILE_VIEWPORT = {"width": 375, "height": 812}


class WebsiteAnalysis:
    def __init__(self):
        self.quality: WebsiteQuality = WebsiteQuality.none
        self.score: int = 0
        self.notes: list[str] = []
        self.has_ssl: bool = False
        self.is_mobile_friendly: bool = False
        self.has_contact_form: bool = False
        self.load_time_ms: Optional[int] = None
        self.last_updated: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "quality": self.quality.value,
            "score": self.score,
            "notes": "; ".join(self.notes),
            "has_ssl": self.has_ssl,
            "is_mobile_friendly": self.is_mobile_friendly,
        }


class WebsiteCheckerService:

    async def analyze(self, url: Optional[str]) -> WebsiteAnalysis:
        result = WebsiteAnalysis()

        if not url:
            result.quality = WebsiteQuality.none
            result.score = 0
            result.notes.append("No website found")
            return result

        # Normalize URL
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Quick reachability check
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.head(url)
                if resp.status_code >= 400:
                    result.quality = WebsiteQuality.poor
                    result.score = 5
                    result.notes.append(f"Website returns HTTP {resp.status_code}")
                    return result
                result.has_ssl = str(resp.url).startswith("https://")
        except Exception as e:
            result.quality = WebsiteQuality.poor
            result.score = 5
            result.notes.append(f"Website unreachable: {str(e)[:100]}")
            return result

        # Deep analysis with Playwright
        try:
            result = await self._playwright_analysis(url, result)
        except Exception as e:
            logger.warning("Playwright analysis failed", url=url, error=str(e))
            result.score = max(result.score, 20)
            result.notes.append("Could not fully analyse website")

        # Map score to quality enum
        if result.score == 0:
            result.quality = WebsiteQuality.none
        elif result.score < 35:
            result.quality = WebsiteQuality.poor
        elif result.score < 60:
            result.quality = WebsiteQuality.outdated
        elif result.score < 80:
            result.quality = WebsiteQuality.mobile_unfriendly
        else:
            result.quality = WebsiteQuality.good

        return result

    async def _playwright_analysis(self, url: str, result: WebsiteAnalysis) -> WebsiteAnalysis:
        score = 0

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)

            # Desktop view
            page = await browser.new_page()
            start = asyncio.get_event_loop().time()

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                load_time = int((asyncio.get_event_loop().time() - start) * 1000)
                result.load_time_ms = load_time

                # SSL
                if url.startswith("https://"):
                    score += 10
                    result.has_ssl = True

                # Load speed
                if load_time < 3000:
                    score += 15
                elif load_time < 6000:
                    score += 8
                else:
                    result.notes.append("Slow load time")

                # Basic content signals
                title = await page.title()
                if title:
                    score += 5

                # Has meta viewport (mobile)
                has_viewport = await page.evaluate(
                    "() => !!document.querySelector('meta[name=viewport]')"
                )
                if has_viewport:
                    score += 10
                else:
                    result.notes.append("No mobile viewport meta tag")

                # Has contact info
                content = (await page.content()).lower()
                if any(kw in content for kw in ["contact", "phone", "email", "whatsapp"]):
                    score += 10
                    result.has_contact_form = True

                # Social links
                if any(kw in content for kw in ["facebook", "instagram", "twitter"]):
                    score += 5

                # Copyright year — detect outdated
                import re
                years = re.findall(r"20[0-9]{2}", content)
                if years:
                    latest_year = max(int(y) for y in years)
                    from datetime import datetime
                    current_year = datetime.now().year
                    if latest_year >= current_year - 1:
                        score += 10
                    else:
                        result.notes.append(f"Last updated around {latest_year}")

            finally:
                await page.close()

            # Mobile view
            mobile_page = await browser.new_context(viewport=MOBILE_VIEWPORT)
            mobile = await mobile_page.new_page()
            try:
                await mobile.goto(url, wait_until="domcontentloaded", timeout=15000)

                # Check for horizontal scroll (mobile unfriendly)
                scrollable = await mobile.evaluate(
                    "() => document.documentElement.scrollWidth > window.innerWidth"
                )
                if not scrollable:
                    score += 15
                    result.is_mobile_friendly = True
                else:
                    result.notes.append("Website has horizontal scroll on mobile")
            except Exception:
                pass
            finally:
                await mobile.close()
                await mobile_page.close()

            await browser.close()

        result.score = min(score, 100)
        return result


website_checker = WebsiteCheckerService()
