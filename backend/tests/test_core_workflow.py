import os
import uuid

import requests


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")


def test_order_crud_tracking_chat_and_privacy():
    payload = {
        "client_name": f"TEST_{uuid.uuid4().hex[:8]}",
        "client_phone": "11999998888",
        "device_type": "Celular",
        "device_model": "TEST iPhone",
        "defect_description": "TEST tela",
        "checklist": [{"label": "Liga", "checked": True}],
        "parts_cost": 80,
        "total_price": 250,
    }
    created = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
    assert created.status_code == 200
    order = created.json()
    assert order["profit"] == 170
    order_id = order["id"]
    code = order["tracking_code"]

    fetched = requests.get(f"{BASE_URL}/api/orders/{order_id}", timeout=15)
    assert fetched.status_code == 200
    assert fetched.json()["client_name"] == payload["client_name"]

    updated = requests.patch(f"{BASE_URL}/api/orders/{order_id}", json={"status": "Em análise"}, timeout=15)
    assert updated.status_code == 200
    assert updated.json()["status"] == "Em análise"

    public = requests.get(f"{BASE_URL}/api/tracking/{code}", timeout=15)
    assert public.status_code == 200
    public_data = public.json()
    assert public_data["profit"] == 0
    assert public_data["parts_cost"] == 0

    sent = requests.post(f"{BASE_URL}/api/orders/{order_id}/messages", json={"sender": "Cliente", "text": "TEST hello"}, timeout=15)
    assert sent.status_code == 200
    listed = requests.get(f"{BASE_URL}/api/orders/{order_id}/messages", timeout=15)
    assert listed.status_code == 200
    assert any(message["text"] == "TEST hello" for message in listed.json())