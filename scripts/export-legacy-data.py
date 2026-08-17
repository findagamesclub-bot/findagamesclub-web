#!/usr/bin/env python3
"""
Export the legacy app's club data as a single JSON payload for import.

Reads through ClubDirectoryStore rather than the raw JSON files, because the
store merges CLUB_ENRICHMENTS (nine clubs keep their images, facilities, social
links and events in Python source, not in data/clubs.json). Exporting the files
directly would land eight of eleven clubs looking empty.

Nothing in ../app is modified.

Usage:  python3 scripts/export-legacy-data.py > scripts/legacy-export.json
"""

from __future__ import annotations  # system python here is 3.9

import json
import re
import sys
from pathlib import Path
from typing import Dict, Optional

APP_DIR = (Path(__file__).resolve().parents[2] / "app").resolve()
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import server  # noqa: E402  (needs the sys.path line above)


def slugify(value: str) -> str:
    value = (value or "").strip().lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def money(raw) -> str | None:
    text = str(raw or "").strip()
    if not text or text.upper() in {"TBC", "N/A", "-"}:
        return None
    match = re.match(r"^GBP\s*([\d.]+)$", text, re.I)
    return f"£{match.group(1)}" if match else text


def clean(value) -> str | None:
    text = str(value or "").strip()
    return text or None


def better_cased(candidate: str, current: str) -> bool:
    """Prefer the spelling with more capitals, so "Bolt Action" beats "bolt action"."""
    return sum(c.isupper() for c in candidate) > sum(c.isupper() for c in current)


def main() -> None:
    clubs = server.CLUB_STORE._load_clubs()

    alias_path = Path(__file__).resolve().parent / "canonical-labels.json"
    aliases = json.loads(alias_path.read_text()) if alias_path.exists() else {}

    # Canonical vocabularies, deduped by slug. Fixes PayPal/Paypal,
    # "Bank transfer"/BACS, "wifi", "warhammer 40k" and friends.
    vocab: Dict[str, Dict[str, str]] = {
        "formats": {}, "games": {}, "facilities": {}, "payment_methods": {}
    }

    def register(kind: str, label: str) -> Optional[str]:
        label = (label or "").strip()
        if not label:
            return None

        # Merge known synonyms first ("aos" and "Age of Sigmar" are one game,
        # "warhammer 40k" and "Warhammer 40,000" are another).
        label = aliases.get(kind, {}).get(label.lower(), label)

        slug = slugify(label)
        if not slug:
            return None

        # Prefer the better-cased spelling: "Bolt Action" over "bolt action".
        existing = vocab[kind].get(slug)
        if existing is None or better_cased(label, existing):
            vocab[kind][slug] = label
        return slug

    out_clubs = []

    for club in clubs:
        venue = club.get("venue") or {}
        coords = venue.get("coordinates") or {}
        contact = club.get("contact") or {}
        pricing = club.get("pricing") or {}
        booking = club.get("booking") or {}
        tiers_block = club.get("membershipTiers") or {}
        settings = tiers_block.get("settings") or {}
        logo = club.get("logo") or {}

        tables = booking.get("tablesAvailable")

        tiers = []
        basic = tiers_block.get("basicTier")
        if isinstance(basic, dict) and basic.get("id"):
            tiers.append({**basic, "_is_basic": True})
        for tier in (tiers_block.get("tiers") or []):
            if isinstance(tier, dict) and tier.get("id"):
                tiers.append({**tier, "_is_basic": False})

        events = []
        for ev in (club.get("upcomingEvents") or []):
            ev_venue = ev.get("venue") or {}
            ev_logo = ev.get("logo") or {}
            events.append({
                "legacy_id": ev.get("id"),
                "title": ev.get("title") or "Untitled event",
                "summary": clean(ev.get("summary")),
                "start_date": clean(ev.get("startDate")),
                "start_time": clean(ev.get("startTime")),
                "end_date": clean(ev.get("endDate")),
                "end_time": clean(ev.get("endTime")),
                "event_type": clean(ev.get("eventType")),
                "event_types": [str(x) for x in (ev.get("eventTypes") or [])],
                "formats": [str(x) for x in (ev.get("formats") or [])],
                "featured_games": [str(x) for x in (ev.get("featuredGames") or [])],
                "facilities": [str(x) for x in (ev.get("facilities") or [])],
                "round_count": ev.get("roundCount"),
                "price": money(ev.get("price")),
                "tickets_available": ev.get("ticketsAvailable"),
                "logo_src": clean(ev_logo.get("src")),
                "logo_alt": clean(ev_logo.get("alt")),
                "venue_name": clean(ev_venue.get("name")),
                "venue_address": clean(ev_venue.get("address")),
                "venue_postcode": clean(ev_venue.get("postcode")),
                "info_board": clean(ev.get("infoBoard")),
                "bestcoast_link": clean(ev.get("bestcoastLink")),
                "social_links": [
                    {"label": s.get("label", ""), "url": s.get("url", "")}
                    for s in (ev.get("socialLinks") or []) if isinstance(s, dict)
                ],
                "ticket_types": [
                    {
                        "label": t.get("label", ""),
                        "price": money(t.get("price")) or "",
                        "audience": clean(t.get("audience")),
                        "audience_label": clean(t.get("audienceLabel")),
                        "minimum_tier_key": clean(t.get("minimumTierId")),
                        "quantity_available": t.get("quantityAvailable"),
                    }
                    for t in (ev.get("ticketTypes") or []) if isinstance(t, dict)
                ],
                "notices": [
                    {"message": n.get("message", "")}
                    for n in (ev.get("notices") or []) if isinstance(n, dict)
                ],
                "results": [
                    {
                        "rank": r.get("rank"),
                        "placement": clean(r.get("placement")),
                        "member_name": r.get("memberName") or "",
                        "member_legacy_id": r.get("memberUserId"),
                        "is_member": bool(r.get("isMember")),
                        "army": r.get("army") or {},
                    }
                    for r in (ev.get("results") or []) if isinstance(r, dict)
                ],
                "pairings": [
                    {"round": p.get("round"), "label": clean(p.get("label")), "matches": p.get("matches") or []}
                    for p in (ev.get("pairings") or []) if isinstance(p, dict)
                ],
            })

        out_clubs.append({
            "id": club["id"],
            "slug": club["slug"],
            "name": club["name"],
            "status": club.get("status") or "active",
            "owner_legacy_id": club.get("ownerUserId"),
            "city": club.get("city") or "",
            "neighbourhood": clean(club.get("neighbourhood")),
            "country": club.get("country") or "United Kingdom",
            "venue_name": clean(venue.get("name")),
            "venue_address": clean(venue.get("address")),
            "venue_postcode": clean(venue.get("postcode")),
            "venue_postcode_district": clean(venue.get("postcodeDistrict")),
            "venue_postcode_area": clean(venue.get("postcodeArea")),
            "latitude": coords.get("latitude"),
            "longitude": coords.get("longitude"),
            "coordinates_label": clean(coords.get("label")),
            "summary": clean(club.get("summary")),
            "description": clean(club.get("description")),
            "logo_url": clean(logo.get("src")),
            # 0 means "no table booking offered", not "none free tonight".
            "tables_available": tables if tables else None,
            "member_count": club.get("memberCount") or None,
            "price_drop_in": money(pricing.get("dropIn")),
            "price_membership": money(pricing.get("membership")),
            "ages": clean(club.get("ages")),
            "accessibility": [str(a) for a in (club.get("accessibility") or [])],
            "tags": [str(t) for t in (club.get("tags") or [])],
            "spotlight": bool(club.get("spotlight")),
            "announcement": clean(club.get("announcement")),
            "contact_email": clean(contact.get("email")),
            "website_url": clean(contact.get("website")),
            "created_at": clean(club.get("createdAt")),

            # Search matches the club's own spellings, not the canonical labels.
            "search_haystack": " ".join(
                [str(g) for g in (club.get("featuredGames") or [])]
                + [str(f) for f in (club.get("facilities") or [])]
            ).lower(),

            "format_slugs": [s for s in (register("formats", f) for f in (club.get("formats") or [])) if s],
            "game_slugs": [s for s in (register("games", g) for g in (club.get("featuredGames") or [])) if s],
            "facility_slugs": [s for s in (register("facilities", f) for f in (club.get("facilities") or [])) if s],
            "payment_slugs": [s for s in (register("payment_methods", p) for p in (club.get("paymentMethods") or [])) if s],
            "discussion_categories": [str(d) for d in (club.get("discussionCategories") or [])],

            "sessions": [
                {"day": s.get("day", ""), "time": s.get("time", ""), "label": s.get("label", "")}
                for s in (club.get("schedule") or []) if isinstance(s, dict)
            ],
            "images": [
                {"src": i.get("src", ""), "alt": i.get("alt", "")}
                for i in (club.get("images") or []) if isinstance(i, dict) and i.get("src")
            ],
            "social_links": [
                {"label": s.get("label", ""), "url": s.get("url", "")}
                for s in (club.get("socialLinks") or []) if isinstance(s, dict) and s.get("url")
            ],
            "pricing_models": [
                {"label": p.get("label", ""), "price": p.get("price", ""), "notes": p.get("notes", "")}
                for p in (club.get("pricingModels") or []) if isinstance(p, dict)
            ],
            "announcements": [
                {"id": a.get("id"), "message": a.get("message", ""), "created_at": clean(a.get("createdAt"))}
                for a in (club.get("announcements") or []) if isinstance(a, dict) and a.get("id")
            ],
            "members": [
                {"legacy_member_id": m.get("id"), "name": m.get("name", ""), "initials": m.get("initials", "")}
                for m in (club.get("members") or []) if isinstance(m, dict)
            ],
            "membership_tiers": [
                {
                    "tier_key": t.get("id"),
                    "label": t.get("label") or "",
                    "price": t.get("price") or "",
                    "price_duration": t.get("priceDuration") or "",
                    "description": clean(t.get("description")),
                    "tone": clean(t.get("tone")),
                    "profile_flair": clean(t.get("profileFlair")),
                    "premium_badge_label": clean(t.get("premiumBadgeLabel")),
                    "is_basic": t.get("_is_basic", False),
                    "benefits": t.get("benefits") or [],
                    "billing_options": t.get("billingOptions") or [],
                }
                for t in tiers
            ],
            "membership_settings": {
                "basic_label": clean(settings.get("basicLabel")),
                "advance_booking_dates": settings.get("advanceBookingDates"),
                "upcoming_booking_limit": settings.get("upcomingBookingLimit"),
                "event_advance_days": settings.get("eventAdvanceDays"),
                "looking_for_game_future_dates": settings.get("lookingForGameFutureDates"),
                "looking_for_game_post_limit": settings.get("lookingForGamePostLimit"),
                "loyalty_redemption_cap_percent": settings.get("loyaltyRedemptionCapPercent"),
            } if settings else None,
            "events": events,
        })

    reviews_path = APP_DIR / "data" / "club-reviews.json"
    reviews_raw = json.loads(reviews_path.read_text()) if reviews_path.exists() else []
    slug_to_id = {c["slug"]: c["id"] for c in out_clubs}
    reviews = [
        {
            "id": r.get("id"),
            "club_id": slug_to_id.get(r.get("clubSlug")),
            "author_legacy_id": r.get("authorUserId"),
            "author_name": r.get("authorName") or "",
            "rating": r.get("rating"),
            "comment": clean(r.get("comment")),
            "flagged_at": clean(r.get("flaggedAt")),
            "flagged_by_name": clean(r.get("flaggedByName")),
            "removed_at": clean(r.get("removedAt")),
            "removed_by_name": clean(r.get("removedByName")),
            "created_at": clean(r.get("createdAt")),
        }
        for r in reviews_raw
        if r.get("id") and slug_to_id.get(r.get("clubSlug")) and r.get("rating")
    ]

    json.dump(
        {
            "exported_from": str(APP_DIR),
            "clubs": out_clubs,
            "reviews": reviews,
            "vocab": {kind: [{"slug": s, "label": l} for s, l in sorted(v.items())] for kind, v in vocab.items()},
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
