from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request
from app.config import settings


def _client_ip(request: Request) -> str:
    """Resolve the real client IP behind Render's reverse proxy.

    Render terminates TLS and forwards the origin IP in ``X-Forwarded-For``.
    Without this, ``get_remote_address`` returns the proxy's socket address,
    which is identical for every user — collapsing all traffic onto a single
    rate-limit bucket.

    ``X-Forwarded-For`` is a client-appendable, comma-separated chain: any
    attacker can *prepend* arbitrary fake IPs, so the leftmost entry is NOT
    trustworthy and must never be used as the rate-limit key (it lets a single
    client rotate through unlimited fake identities to evade limits). Only the
    right-hand entries — appended by our own trusted proxies — are reliable. We
    therefore count ``TRUSTED_PROXY_HOPS`` in from the right to reach the IP the
    outermost trusted proxy observed, and fall back to the socket address when
    the header is absent or malformed (e.g. local dev).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            hops = max(1, settings.TRUSTED_PROXY_HOPS)
            # Clamp to the chain length so a shorter-than-expected chain (or a
            # spoofed short one) resolves to the leftmost real entry we have
            # rather than raising.
            idx = min(hops, len(parts))
            return parts[-idx]
    return get_remote_address(request)


limiter = Limiter(
    key_func=_client_ip,
    storage_uri=settings.REDIS_URL,
)
