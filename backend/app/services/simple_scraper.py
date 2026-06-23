"""
Simple Google Maps scraper using requests — no browser, no API key needed.
Uses the undocumented Maps search endpoint to find businesses.
Falls back gracefully if blocked.
"""

import httpx
import re
import json
import asyncio
from typing import List, Optional
from app.services.scraper import BusinessData
from app.utils.helpers import normalize_phone, clean_business_name
from app.config import settings
import structlog

logger = structlog.get_logger()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


class SimpleScraperService:
    """
    Lightweight scraper — searches Google Maps via HTTP requests.
    No browser required. Works for basic business discovery.
    """

    async def search_businesses(
        self,
        niche: str,
        city: str,
        country: str,
        max_results: int = 60,
    ) -> List[BusinessData]:
        results: List[BusinessData] = []
        query = f"{niche} in {city} {country}"

        async with httpx.AsyncClient(headers=HEADERS, timeout=30, follow_redirects=True) as client:
            try:
                # Search via Google Maps search URL
                search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
                resp = await client.get(search_url)

                # Extract JSON data embedded in the page
                raw = resp.text

                # Find business data blocks in the Maps response
                # Google embeds business data as JSON arrays in the HTML
                pattern = r'\["([^"]+)",null,\[null,null,(\d+\.\d+),(\d+\.\d+)\]'
                matches = re.findall(pattern, raw)

                # Also try to extract from the window.APP_INITIALIZATION_STATE
                json_pattern = r'APP_INITIALIZATION_STATE\s*=\s*(\[.+?\]);'
                json_matches = re.findall(json_pattern, raw[:50000])

                logger.info("Simple scraper search", query=query, html_size=len(raw))

                # If we can't parse structured data, return search result stubs
                # that can be enriched manually
                if not matches and not json_matches:
                    logger.warning("Could not parse Maps data, returning empty", query=query)
                    return []

                for name, lat, lng in matches[:max_results]:
                    if not name or len(name) < 2:
                        continue
                    biz = BusinessData(
                        business_name=clean_business_name(name),
                        city=city,
                        country=country,
                        category=niche,
                    )
                    results.append(biz)
                    await asyncio.sleep(0.1)

            except Exception as e:
                logger.error("Simple scraper failed", error=str(e))

        return results[:max_results]


simple_scraper = SimpleScraperService()
