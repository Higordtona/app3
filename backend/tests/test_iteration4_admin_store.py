"""Iteration 4: PIN gate (401 sem token), Caixa (despesas + fluxo de caixa),
Loja pública (config, privacidade, pedido Pix), regressão tracking por código ou id."""
import uuid

MONTH = "2026-10"
PIX_KEY = "99991743443"


class TestAdminGate:
    """Painel da equipe protegido por PIN"""

    def test_unlock_wrong_pin_401(self, api_client, base_url):
        resp = api_client.post(f"{base_url}/api/admin/unlock", json={"pin": "0000000"}, timeout=15)
        assert resp.status_code == 401

    def test_unlock_bad_format_400(self, api_client, base_url):
        resp = api_client.post(f"{base_url}/api/admin/unlock", json={"pin": "12"}, timeout=15)
        assert resp.status_code == 400

    def test_orders_require_token(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/orders", timeout=15)
        assert resp.status_code == 401

    def test_products_require_token(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/products", timeout=15)
        assert resp.status_code == 401

    def test_sales_require_token(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/sales", timeout=15)
        assert resp.status_code == 401

    def test_cashflow_requires_token(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/cashflow?month={MONTH}", timeout=15)
        assert resp.status_code == 401

    def test_expenses_require_token(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/expenses?month={MONTH}", timeout=15)
        assert resp.status_code == 401

    def test_admin_token_grants_access(self, admin_client, base_url):
        resp = admin_client.get(f"{base_url}/api/orders", timeout=15)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestCashbox:
    """Despesas mensais e fluxo de caixa (vendas + OS entregues - despesas = saldo)"""

    def test_cashflow_invalid_month_400(self, admin_client, base_url):
        resp = admin_client.get(f"{base_url}/api/cashflow?month=10-2026", timeout=15)
        assert resp.status_code == 400

    def test_expense_invalid_amount_400(self, admin_client, base_url):
        resp = admin_client.post(f"{base_url}/api/expenses", json={"description": "TEST_ zero", "amount": 0, "month": MONTH}, timeout=15)
        assert resp.status_code == 400

    def test_expense_crud_updates_balance(self, admin_client, base_url):
        before = admin_client.get(f"{base_url}/api/cashflow?month={MONTH}", timeout=15).json()
        amount = 123.45
        created = admin_client.post(f"{base_url}/api/expenses", json={
            "description": f"TEST_Caixa_{uuid.uuid4().hex[:6]}", "category": "Outros", "amount": amount, "month": MONTH,
        }, timeout=15)
        assert created.status_code == 200, created.text
        expense = created.json()
        assert expense["amount"] == amount and expense["month"] == MONTH

        # GET lista verifica persistência
        listed = admin_client.get(f"{base_url}/api/expenses?month={MONTH}", timeout=15)
        assert any(item["id"] == expense["id"] for item in listed.json())

        after = admin_client.get(f"{base_url}/api/cashflow?month={MONTH}", timeout=15).json()
        assert round(after["expenses_total"] - before["expenses_total"], 2) == amount
        assert round(after["balance"] - before["balance"], 2) == -amount

        # Excluir devolve o valor ao saldo
        deleted = admin_client.delete(f"{base_url}/api/expenses/{expense['id']}", timeout=15)
        assert deleted.status_code == 204
        restored = admin_client.get(f"{base_url}/api/cashflow?month={MONTH}", timeout=15).json()
        assert restored["expenses_total"] == before["expenses_total"]
        assert restored["balance"] == before["balance"]
        gone = admin_client.get(f"{base_url}/api/expenses?month={MONTH}", timeout=15)
        assert not any(item["id"] == expense["id"] for item in gone.json())

    def test_cashflow_balance_formula(self, admin_client, base_url):
        flow = admin_client.get(f"{base_url}/api/cashflow?month={MONTH}", timeout=15).json()
        assert flow["balance"] == round(flow["sales_total"] + flow["orders_revenue"] - flow["expenses_total"], 2)


class TestStorePublic:
    """Loja pública do cliente (sem custo/lucro) + pedido Pix"""

    def test_store_config(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/store/config", timeout=15)
        assert resp.status_code == 200
        data = resp.json()
        assert data["pix_key"] == PIX_KEY
        assert data["mercado_pago_enabled"] is False  # token não configurado — ESPERADO

    def test_store_products_hide_cost_and_profit(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/store/products", timeout=15)
        assert resp.status_code == 200
        products = resp.json()
        assert isinstance(products, list) and len(products) > 0
        for product in products:
            assert "cost_price" not in product
            assert "profit" not in product
            assert "min_stock" not in product
            assert product["stock_qty"] > 0
            assert {"id", "name", "sale_price", "category"} <= set(product.keys())

    def test_store_order_requires_name_and_phone(self, api_client, base_url):
        resp = api_client.post(f"{base_url}/api/store/orders", json={
            "client_name": " ", "client_phone": "", "items": [{"product_id": "x", "quantity": 1}], "payment_method": "Pix",
        }, timeout=15)
        assert resp.status_code == 400

    def test_store_order_mercado_pago_without_token_503(self, api_client, base_url):
        products = api_client.get(f"{base_url}/api/store/products", timeout=15).json()
        if not products:
            import pytest
            pytest.skip("Sem produtos na loja")
        resp = api_client.post(f"{base_url}/api/store/orders", json={
            "client_name": "TEST_MP", "client_phone": "11999990000",
            "items": [{"product_id": products[0]["id"], "quantity": 1}], "payment_method": "Mercado Pago",
        }, timeout=15)
        assert resp.status_code == 503  # token MP vazio — esperado

    def test_store_order_pix_full_flow(self, api_client, admin_client, base_url):
        products = api_client.get(f"{base_url}/api/store/products", timeout=15).json()
        if not products:
            import pytest
            pytest.skip("Sem produtos na loja")
        product = products[0]
        stock_before = admin_client.get(f"{base_url}/api/products/{product['id']}", timeout=15).json()["stock_qty"]

        resp = api_client.post(f"{base_url}/api/store/orders", json={
            "client_name": f"TEST_Loja_{uuid.uuid4().hex[:6]}", "client_phone": "11988887777",
            "items": [{"product_id": product["id"], "quantity": 1}], "payment_method": "Pix",
        }, timeout=20)
        assert resp.status_code == 200, resp.text
        result = resp.json()
        assert result["pix_key"] == PIX_KEY
        assert result["total"] == product["sale_price"]
        sale_id = result["sale_id"]

        # Estoque baixou
        stock_after = admin_client.get(f"{base_url}/api/products/{product['id']}", timeout=15).json()["stock_qty"]
        assert stock_after == stock_before - 1

        # Pedido aparece no ADM como canal 'loja' aguardando pagamento
        sales = admin_client.get(f"{base_url}/api/sales", timeout=15).json()
        sale = next((item for item in sales if item["id"] == sale_id), None)
        assert sale is not None
        assert sale["channel"] == "loja"
        assert sale["payment_status"] == "Aguardando pagamento"
        assert sale["client_name"].startswith("TEST_Loja_")

        # Confirmar pagamento -> Pago
        paid = admin_client.patch(f"{base_url}/api/sales/{sale_id}", json={"payment_status": "Pago"}, timeout=15)
        assert paid.status_code == 200
        assert paid.json()["payment_status"] == "Pago"


class TestTrackingRegression:
    """Bug crítico it.3: /api/tracking/{code} deve aceitar TF-XXXXXX ou id da OS"""

    def test_tracking_by_code(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/tracking/TF-066E2A", timeout=15)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["tracking_code"] == "TF-066E2A"
        assert data["profit"] == 0 and data["parts_cost"] == 0  # privacidade do cliente

    def test_tracking_by_order_uuid(self, api_client, base_url):
        by_code = api_client.get(f"{base_url}/api/tracking/TF-066E2A", timeout=15).json()
        resp = api_client.get(f"{base_url}/api/tracking/{by_code['id']}", timeout=15)
        assert resp.status_code == 200, "tracking por id da OS deve funcionar (regressão it.3)"
        assert resp.json()["id"] == by_code["id"]

    def test_tracking_lowercase_code(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/tracking/tf-066e2a", timeout=15)
        assert resp.status_code == 200

    def test_tracking_invalid_404(self, api_client, base_url):
        resp = api_client.get(f"{base_url}/api/tracking/TF-ZZZZZZ", timeout=15)
        assert resp.status_code == 404
