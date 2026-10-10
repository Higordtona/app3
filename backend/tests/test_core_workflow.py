"""Regressão: CRUD de OS, tracking público com privacidade e chat."""
import uuid


def test_order_crud_tracking_chat_and_privacy(admin_client, api_client, base_url):
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
    created = admin_client.post(f"{base_url}/api/orders", json=payload, timeout=15)
    assert created.status_code == 200, created.text
    order = created.json()
    assert order["profit"] == 170
    order_id = order["id"]
    code = order["tracking_code"]

    fetched = admin_client.get(f"{base_url}/api/orders/{order_id}", timeout=15)
    assert fetched.status_code == 200
    assert fetched.json()["client_name"] == payload["client_name"]

    updated = admin_client.patch(f"{base_url}/api/orders/{order_id}", json={"status": "Em análise"}, timeout=15)
    assert updated.status_code == 200
    assert updated.json()["status"] == "Em análise"

    public = api_client.get(f"{base_url}/api/tracking/{code}", timeout=15)
    assert public.status_code == 200
    public_data = public.json()
    assert public_data["profit"] == 0
    assert public_data["parts_cost"] == 0

    # tracking também aceita o id da OS (correção it.3)
    by_id = api_client.get(f"{base_url}/api/tracking/{order_id}", timeout=15)
    assert by_id.status_code == 200
    assert by_id.json()["id"] == order_id

    sent = api_client.post(f"{base_url}/api/orders/{order_id}/messages", json={"sender": "Cliente", "text": "TEST hello"}, timeout=15)
    assert sent.status_code == 200
    listed = api_client.get(f"{base_url}/api/orders/{order_id}/messages", timeout=15)
    assert listed.status_code == 200
    assert any(message["text"] == "TEST hello" for message in listed.json())
