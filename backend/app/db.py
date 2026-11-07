"""MongoDB connection (same database and collection the app has always used)."""

import logging

import dns.asyncresolver
import dns.resolver
from pymongo import AsyncMongoClient
from pymongo.errors import ConfigurationError

from .config import env

log = logging.getLogger(__name__)

# Mongoose stored pages through the "funnelPage" model, i.e. this collection.
COLLECTION = "funnelpages"
PUBLIC_DNS = ["1.1.1.1", "8.8.8.8"]

_client: AsyncMongoClient | None = None


def _use_public_dns() -> None:
    """mongodb+srv:// needs an SRV lookup, which some resolvers refuse."""
    sync_resolver = dns.resolver.Resolver(configure=False)
    sync_resolver.nameservers = PUBLIC_DNS
    dns.resolver.default_resolver = sync_resolver
    async_resolver = dns.asyncresolver.Resolver(configure=False)
    async_resolver.nameservers = PUBLIC_DNS
    dns.asyncresolver.default_resolver = async_resolver


async def _connect(uri: str) -> AsyncMongoClient:
    client = AsyncMongoClient(uri, tz_aware=True)
    await client.admin.command("ping")
    return client


async def get_client() -> AsyncMongoClient:
    global _client
    if _client is not None:
        return _client
    uri = env("MONGODB_URI")
    if not uri:
        raise RuntimeError("Please define the MONGODB_URI environment variable inside .env")
    try:
        _client = await _connect(uri)
    except ConfigurationError as error:
        if not uri.startswith("mongodb+srv://"):
            raise
        log.warning("SRV lookup failed (%s); retrying with public DNS", error)
        _use_public_dns()
        _client = await _connect(uri)
    return _client


async def get_collection():
    client = await get_client()
    # Mongoose falls back to the "test" database when the URI names none.
    return client.get_default_database(default="test")[COLLECTION]


async def close() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
