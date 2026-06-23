"""
Google Maps scraping service.

Primary method: Google Places API (requires GOOGLE_PLACES_API_KEY).
Fallback: Playwright-based scraper (use responsibly, respect robots.txt).
"""

import asyncio
import time
import json
import re
from typing import List, Optional, Dict, Any
import httpx
from playwright.async_api import async_playwright, Page
from app.config import settings
from app.utils.helpers import normalize_phone, clean_business_name
import structlog

logger = structlog.get_logger()


class BusinessData:
    def __init__(self, **kwargs):
        self.business_name: str = kwargs.get("business_name", "")
        self.category: str = kwargs.get("category", "")
        self.address: str = kwargs.get("address", "")
        self.city: str = kwargs.get("city", "")
        self.country: str = kwargs.get("country", "")
        self.phone: Optional[str] = kwargs.get("phone")
        self.website: Optional[str] = kwargs.get("website")
        self.email: Optional[str] = kwargs.get("email")
        self.rating: Optional[float] = kwargs.get("rating")
        self.review_count: int = kwargs.get("review_count", 0)
        self.google_maps_url: Optional[str] = kwargs.get("google_maps_url")
        self.google_place_id: Optional[str] = kwargs.get("google_place_id")
        self.is_verified: bool = kwargs.get("is_verified", False)

    def to_dict(self) -> Dict[str, Any]:
        return self.__dict__


class GooglePlacesService:
    """Official Google Places API — preferred method."""

    BASE_URL = "https://maps.googleapis.com/maps/api"

    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY

    async def search_businesses(
        self,
        niche: str,
        city: str,
        country: str,
        max_results: int = 60,
    ) -> List[BusinessData]:
        if not self.api_key:
            raise ValueError("GOOGLE_PLACES_API_KEY not configured")

        results: List[BusinessData] = []
        query = f"{niche} in {city}, {country}"
        next_page_token = None

        async with httpx.AsyncClient() as client:
            while len(results) < max_results:
                params = {
                    "query": query,
                    "key": self.api_key,
                    "fields": "place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry",
                }
                if next_page_token:
                    params = {"pagetoken": next_page_token, "key": self.api_key}

                resp = await client.get(f"{self.BASE_URL}/place/textsearch/json", params=params)
                data = resp.json()

                if data.get("status") not in ("OK", "ZERO_RESULTS"):
                    logger.warning("Places API error", status=data.get("status"))
                    break

                for place in data.get("results", []):
                    detail = await self._get_place_detail(client, place["place_id"])
                    biz = BusinessData(
                        business_name=clean_business_name(place.get("name", "")),
                        address=place.get("formatted_address", ""),
                        city=city,
                        country=country,
                        phone=normalize_phone(detail.get("formatted_phone_number", "")),
                        website=detail.get("website"),
                        rating=place.get("rating"),
                        review_count=place.get("user_ratings_total", 0),
                        google_place_id=place["place_id"],
                        google_maps_url=f"https://www.google.com/maps/place/?q=place_id:{place['place_id']}",
                    )
                    results.append(biz)

                next_page_token = data.get("next_page_token")
                if not next_page_token:
                    break
                await asyncio.sleep(2)  # required delay between paginated requests

        return results[:max_results]

    async def _get_place_detail(self, client: httpx.AsyncClient, place_id: str) -> Dict:
        resp = await client.get(
            f"{self.BASE_URL}/place/details/json",
            params={
                "place_id": place_id,
                "fields": "website,formatted_phone_number,international_phone_number",
                "key": self.api_key,
            },
        )
        return resp.json().get("result", {})


class PlaywrightScraper:
    """
    Playwright-based Google Maps scraper.
    Use only when Places API is unavailable.
    Includes delays to be respectful of rate limits.
    """

    async def search_businesses(
        self,
        niche: str,
        city: str,
        country: str,
        max_results: int = 60,
    ) -> List[BusinessData]:
        results: List[BusinessData] = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = await context.new_page()

            search_query = f"{niche} {city} {country}"
            maps_url = f"https://www.google.com/maps/search/{search_query.replace(' ', '+')}"

            await page.goto(maps_url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            # Scroll to load more results
            results_panel = await page.query_selector('[role="feed"]')
            if results_panel:
                for _ in range(5):
                    await results_panel.evaluate("el => el.scrollTop = el.scrollHeight")
                    await asyncio.sleep(2)

            listing_links = await page.query_selector_all('a[href*="/maps/place/"]')
            hrefs = []
            seen = set()
            for link in listing_links:
                href = await link.get_attribute("href")
                if href and href not in seen:
                    seen.add(href)
                    hrefs.append(href)

            for href in hrefs[:max_results]:
                try:
                    biz = await self._scrape_place_page(page, href, city, country)
                    if biz:
                        results.append(biz)
                    await asyncio.sleep(settings.SCRAPING_DELAY_SECONDS)
                except Exception as e:
                    logger.warning("Failed to scrape place", url=href, error=str(e))

            await browser.close()

        return results

    async def _scrape_place_page(
        self, page: Page, url: str, city: str, country: str
    ) -> Optional[BusinessData]:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(2)

        async def get_text(selector: str) -> str:
            el = await page.query_selector(selector)
            return (await el.inner_text()).strip() if el else ""

        name = await get_text('h1[data-item-id]') or await get_text("h1.DUwDvf")
        if not name:
            return None

        phone_el = await page.query_selector('[data-tooltip="Copy phone number"]')
        phone = await phone_el.get_attribute("data-item-id") if phone_el else ""
        phone = re.sub(r"[^+\d]", "", phone or "")

        website_el = await page.query_selector('[data-tooltip="Open website"]')
        website = await website_el.get_attribute("href") if website_el else None

        rating_text = await get_text('span[aria-label*="stars"]') or ""
        rating = None
        try:
            rating = float(re.search(r"[\d.]+", rating_text).group())
        except Exception:
            pass

        reviews_text = await get_text('span[aria-label*="reviews"]') or ""
        review_count = 0
        try:
            review_count = int(re.sub(r"[^\d]", "", reviews_text))
        except Exception:
            pass

        place_id_match = re.search(r"place/([^/]+)/", url)
        place_id = place_id_match.group(1) if place_id_match else None

        return BusinessData(
            business_name=clean_business_name(name),
            city=city,
            country=country,
            phone=normalize_phone(phone) if phone else None,
            website=website,
            rating=rating,
            review_count=review_count,
            google_maps_url=url,
            google_place_id=place_id,
        )


class ScraperService:
    """
    Unified scraper with 3-tier fallback:
    1. Google Places API (if key + billing enabled)
    2. Playwright browser scraper (if Chromium installed)
    3. Simple HTTP scraper (always available, limited data)
    """

    def __init__(self):
        self._places     = GooglePlacesService()
        self._playwright = PlaywrightScraper()

    async def scrape(
        self,
        niche: str,
        city: str,
        country: str,
        max_results: int = 60,
    ) -> List[BusinessData]:
        # Tier 1: Google Places API
        if settings.GOOGLE_PLACES_API_KEY:
            logger.info("Using Google Places API", niche=niche, city=city)
            try:
                return await self._places.search_businesses(niche, city, country, max_results)
            except Exception as e:
                logger.warning("Places API failed, falling back", error=str(e))

        # Tier 2: Playwright browser scraper
        try:
            from playwright.async_api import async_playwright
            logger.info("Using Playwright scraper", niche=niche, city=city)
            return await self._playwright.search_businesses(niche, city, country, max_results)
        except Exception as e:
            logger.warning("Playwright failed, falling back to simple scraper", error=str(e))

        # Tier 3: Simple HTTP scraper (no browser needed)
        from app.services.simple_scraper import simple_scraper
        logger.info("Using simple HTTP scraper", niche=niche, city=city)
        return await simple_scraper.search_businesses(niche, city, country, max_results)


scraper_service = ScraperService()
