"""Regressão: produtos, estoque, vendas, upload e push (rotas admin exigem token)."""
import uuid
import io

import pytest
import requests


class TestHealth:
    """Backend health check"""

    def test_root(self, admin_client, base_url):
        resp = admin_client.get(f"{base_url}/api/", timeout=15)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "online"


class TestProductCRUD:
    """Product create -> get -> patch -> verify persistence"""

    def test_create_product_and_verify_persistence(self, admin_client, base_url):
        payload = {
            "name": f"TEST_Produto_{uuid.uuid4().hex[:6]}",
            "sku": "TEST-SKU-1",
            "category": "TEST Telas",
            "cost_price": 100,
            "sale_price": 180,
            "stock_qty": 5,
            "min_stock": 2,
        }
        created = admin_client.post(f"{base_url}/api/products", json=payload, timeout=15)
        assert created.status_code == 200, created.text
        product = created.json()
        assert product["name"] == payload["name"]
        assert product["stock_qty"] == 5
        product_id = product["id"]

        fetched = admin_client.get(f"{base_url}/api/products/{product_id}", timeout=15)
        assert fetched.status_code == 200
        assert fetched.json()["sale_price"] == 180
        TestProductCRUD.product_id = product_id

    def test_update_product(self, admin_client, base_url):
        product_id = getattr(TestProductCRUD, "product_id", None)
        if not product_id:
            pytest.skip("No product created")
        updated = admin_client.patch(f"{base_url}/api/products/{product_id}", json={"sale_price": 200, "min_stock": 3}, timeout=15)
        assert updated.status_code == 200, updated.text
        assert updated.json()["sale_price"] == 200
        assert updated.json()["min_stock"] == 3

        fetched = admin_client.get(f"{base_url}/api/products/{product_id}", timeout=15)
        assert fetched.json()["sale_price"] == 200

    def test_get_product_not_found(self, admin_client, base_url):
        resp = admin_client.get(f"{base_url}/api/products/{uuid.uuid4()}", timeout=15)
        assert resp.status_code == 404

    def test_list_products(self, admin_client, base_url):
        resp = admin_client.get(f"{base_url}/api/products", timeout=15)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestStock:
    """Stock adjustments, negative guard"""

    def test_stock_adjust_up_and_down(self, admin_client, base_url):
        payload = {"name": f"TEST_Estoque_{uuid.uuid4().hex[:6]}", "cost_price": 10, "sale_price": 20, "stock_qty": 3, "min_stock": 1}
        product = admin_client.post(f"{base_url}/api/products", json=payload, timeout=15).json()
        pid = product["id"]

        up = admin_client.post(f"{base_url}/api/products/{pid}/stock", json={"delta": 2}, timeout=15)
        assert up.status_code == 200
        assert up.json()["stock_qty"] == 5

        down = admin_client.post(f"{base_url}/api/products/{pid}/stock", json={"delta": -2}, timeout=15)
        assert down.status_code == 200
        assert down.json()["stock_qty"] == 3

    def test_stock_cannot_go_negative(self, admin_client, base_url):
        payload = {"name": f"TEST_Neg_{uuid.uuid4().hex[:6]}", "stock_qty": 1}
        product = admin_client.post(f"{base_url}/api/products", json=payload, timeout=15).json()
        resp = admin_client.post(f"{base_url}/api/products/{product['id']}/stock", json={"delta": -5}, timeout=15)
        assert resp.status_code == 400
        assert "negativo" in resp.json()["detail"].lower() or "Estoque" in resp.json()["detail"]

    def test_stock_delta_zero_rejected(self, admin_client, base_url):
        payload = {"name": f"TEST_Zero_{uuid.uuid4().hex[:6]}", "stock_qty": 1}
        product = admin_client.post(f"{base_url}/api/products", json=payload, timeout=15).json()
        resp = admin_client.post(f"{base_url}/api/products/{product['id']}/stock", json={"delta": 0}, timeout=15)
        assert resp.status_code == 400


class TestSales:
    """Sale creation decrements stock, totals/profit correct, insufficient stock rejected"""

    def test_create_sale_decrements_stock(self, admin_client, base_url):
        payload = {"name": f"TEST_Venda_{uuid.uuid4().hex[:6]}", "cost_price": 50, "sale_price": 90, "stock_qty": 4, "min_stock": 1}
        product = admin_client.post(f"{base_url}/api/products", json=payload, timeout=15).json()
        pid = product["id"]

        sale_resp = admin_client.post(f"{base_url}/api/sales", json={"items": [{"product_id": pid, "quantity": 2}], "payment_method": "Pix"}, timeout=15)
        assert sale_resp.status_code == 200, sale_resp.text
        sale = sale_resp.json()
        assert sale["total"] == 180
        assert sale["cost_total"] == 100
        assert sale["profit"] == 80
        assert sale["payment_method"] == "Pix"
        assert sale["items"][0]["quantity"] == 2

        # Verify stock decremented
        fetched = admin_client.get(f"{base_url}/api/products/{pid}", timeout=15)
        assert fetched.json()["stock_qty"] == 2

        # Sale listed
        sales = admin_client.get(f"{base_url}/api/sales", timeout=15).json()
        assert any(s["id"] == sale["id"] for s in sales)

    def test_sale_insufficient_stock_rejected(self, admin_client, base_url):
        payload = {"name": f"TEST_Insuf_{uuid.uuid4().hex[:6]}", "cost_price": 10, "sale_price": 30, "stock_qty": 1}
        product = admin_client.post(f"{base_url}/api/products", json=payload, timeout=15).json()
        resp = admin_client.post(f"{base_url}/api/sales", json={"items": [{"product_id": product["id"], "quantity": 5}]}, timeout=15)
        assert resp.status_code == 400
        assert "insuficiente" in resp.json()["detail"].lower()

    def test_sale_empty_items_rejected(self, admin_client, base_url):
        resp = admin_client.post(f"{base_url}/api/sales", json={"items": []}, timeout=15)
        assert resp.status_code == 400


class TestUpload:
    """Object Storage upload and file download"""

    def test_upload_image_and_download(self, admin_client, base_url, admin_token):
        # Minimal valid PNG (1x1)
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d494844520000000100000001080600000"
            "01f15c4890000000d4944415478da63fcffff3f030005fe02fea72d994d"
            "0000000049454e44ae426082"
        )
        resp = requests.post(f"{base_url}/api/upload", files={"file": ("teste.png", io.BytesIO(png), "image/png")}, headers={"X-Admin-Token": admin_token}, timeout=60)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["path"].startswith("hdtech/uploads/")
        assert data["url"].startswith("/api/files/")

        dl = requests.get(f"{base_url}{data['url']}", timeout=60)
        assert dl.status_code == 200
        assert dl.headers.get("Content-Type") == "image/png"
        assert dl.content == png

    def test_upload_invalid_type_rejected(self, admin_token, base_url):
        resp = requests.post(f"{base_url}/api/upload", files={"file": ("teste.txt", io.BytesIO(b"hello"), "text/plain")}, headers={"X-Admin-Token": admin_token}, timeout=30)
        assert resp.status_code == 400

    def test_upload_requires_token(self, base_url):
        resp = requests.post(f"{base_url}/api/upload", files={"file": ("t.png", io.BytesIO(b"x"), "image/png")}, timeout=15)
        assert resp.status_code == 401

    def test_files_wrong_app_prefix_404(self, admin_client, base_url):
        resp = admin_client.get(f"{base_url}/api/files/outro-app/uploads/abc.png", timeout=15)
        assert resp.status_code == 404


class TestPush:
    """Push registration — 500 expected in preview (placeholder key), non-blocking elsewhere"""

    def test_register_push_expected_500_in_preview(self, admin_client, base_url):
        resp = admin_client.post(f"{base_url}/api/register-push", json={"user_id": "TEST-user", "platform": "android", "device_token": "TEST-token"}, timeout=20)
        # Placeholder key -> 500 is EXPECTED before deploy; 201/502 also acceptable but not 4xx validation
        assert resp.status_code in (201, 500, 502), resp.text
        if resp.status_code == 500:
            assert "EMERGENT_PUSH_KEY" in resp.json().get("detail", "")

    def test_status_change_still_works_with_push_failure(self, admin_client, base_url):
        payload = {
            "client_name": f"TEST_Push_{uuid.uuid4().hex[:6]}",
            "client_phone": "11999998888",
            "device_type": "Notebook",
            "device_model": "TEST Dell",
            "defect_description": "TEST push",
        }
        order = admin_client.post(f"{base_url}/api/orders", json=payload, timeout=15).json()
        updated = admin_client.patch(f"{base_url}/api/orders/{order['id']}", json={"status": "Em reparo"}, timeout=30)
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == "Em reparo"

    def test_chat_message_still_works_with_push_failure(self, admin_client, base_url):
        payload = {
            "client_name": f"TEST_PushChat_{uuid.uuid4().hex[:6]}",
            "client_phone": "11999998888",
            "device_type": "Celular",
            "device_model": "TEST Moto",
            "defect_description": "TEST push chat",
        }
        order = admin_client.post(f"{base_url}/api/orders", json=payload, timeout=15).json()
        sent = admin_client.post(f"{base_url}/api/orders/{order['id']}/messages", json={"sender": "Técnico", "text": "TEST push msg"}, timeout=30)
        assert sent.status_code == 200, sent.text
        assert sent.json()["text"] == "TEST push msg"


class TestPhotoFallback:
    """Photos endpoint accepts url-based photos (Object Storage) and data-based (base64 legacy)"""

    def test_add_photo_with_storage_url(self, admin_client, base_url):
        payload = {
            "client_name": f"TEST_Foto_{uuid.uuid4().hex[:6]}",
            "client_phone": "11999998888",
            "device_type": "Celular",
            "device_model": "TEST S23",
            "defect_description": "TEST foto",
        }
        order = admin_client.post(f"{base_url}/api/orders", json=payload, timeout=15).json()
        photo_resp = admin_client.post(
            f"{base_url}/api/orders/{order['id']}/photos",
            json={"category": "repair", "url": "/api/files/hdtech/uploads/fake.jpg"},
            timeout=15,
        )
        assert photo_resp.status_code == 200, photo_resp.text
        photos = photo_resp.json()["photos"]
        assert len(photos) == 1
        assert photos[0]["url"] == "/api/files/hdtech/uploads/fake.jpg"
