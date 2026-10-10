import os

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
ADMIN_PIN = os.environ.get("TEST_ADMIN_PIN") or os.environ.get("ADMIN_PIN")


@pytest.fixture(scope="session")
def base_url():
    if not BASE_URL:
        pytest.skip("EXPO_PUBLIC_BACKEND_URL not set")
    return BASE_URL


@pytest.fixture(scope="session")
def api_client(base_url):
    """Anonymous client (no admin token)"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(api_client, base_url):
    """Unlock the staff panel once per session using the configured test PIN."""
    if not ADMIN_PIN:
        pytest.skip("Set TEST_ADMIN_PIN or ADMIN_PIN to run authenticated API tests")
    resp = api_client.post(f"{base_url}/api/admin/unlock", json={"pin": ADMIN_PIN}, timeout=15)
    assert resp.status_code == 200, f"Admin unlock failed: {resp.text}"
    data = resp.json()
    assert "token" in data and "expiresAt" in data
    return data["token"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    """Client with X-Admin-Token header"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "X-Admin-Token": admin_token})
    return session
