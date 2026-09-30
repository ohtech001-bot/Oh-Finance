ALTER TABLE orders ADD COLUMN returned_amount NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD CONSTRAINT orders_returned_amount_check
  CHECK (returned_amount >= 0 AND returned_amount <= total);

CREATE TABLE order_returns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  amount NUMERIC(18,4) NOT NULL CHECK (amount >= 0),
  reason VARCHAR(500),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_returns_tenant_id_request_id_key ON order_returns(tenant_id, request_id);
CREATE INDEX order_returns_tenant_id_order_id_idx ON order_returns(tenant_id, order_id);

CREATE TABLE order_return_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  return_id UUID NOT NULL REFERENCES order_returns(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  amount NUMERIC(18,4) NOT NULL CHECK (amount >= 0)
);
CREATE UNIQUE INDEX order_return_items_order_item_id_key ON order_return_items(order_item_id);
CREATE INDEX order_return_items_tenant_id_return_id_idx ON order_return_items(tenant_id, return_id);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['order_returns', 'order_return_items'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant())', t);
    EXECUTE format('CREATE POLICY platform_access ON %I USING (app_is_platform()) WITH CHECK (app_is_platform())', t);
    EXECUTE format('GRANT SELECT, INSERT ON %I TO oh_app', t);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM oh_app', t);
  END LOOP;
END $$;

CREATE FUNCTION app_validate_order_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Order returns are immutable';
  END IF;
  IF TG_TABLE_NAME = 'order_returns' THEN
    IF NOT EXISTS (SELECT 1 FROM orders WHERE id = NEW.order_id AND tenant_id = NEW.tenant_id AND locked_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Invalid return order';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM order_returns r JOIN order_items i ON i.order_id = r.order_id
      WHERE r.id = NEW.return_id AND i.id = NEW.order_item_id
        AND r.tenant_id = NEW.tenant_id AND i.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Invalid return item';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_returns_validate BEFORE INSERT OR UPDATE OR DELETE ON order_returns
  FOR EACH ROW EXECUTE FUNCTION app_validate_order_return();
CREATE TRIGGER order_return_items_validate BEFORE INSERT OR UPDATE OR DELETE ON order_return_items
  FOR EACH ROW EXECUTE FUNCTION app_validate_order_return();

-- Deferred checks see the complete transaction, including the ledger and order update.
CREATE FUNCTION app_check_order_return_totals() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_return_id UUID;
  v_return order_returns%ROWTYPE;
  v_order orders%ROWTYPE;
  v_items NUMERIC(18,4);
  v_count INTEGER;
  v_total NUMERIC(18,4);
BEGIN
  IF TG_TABLE_NAME = 'order_returns' THEN
    v_return_id := NEW.id;
  ELSE
    v_return_id := NEW.return_id;
  END IF;
  SELECT * INTO STRICT v_return FROM order_returns WHERE id = v_return_id;
  SELECT * INTO STRICT v_order FROM orders WHERE id = v_return.order_id;
  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO v_items, v_count
    FROM order_return_items WHERE return_id = v_return_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM order_returns WHERE order_id = v_return.order_id;
  IF v_count = 0 OR v_items <> v_return.amount OR v_total <> v_order.returned_amount THEN
    RAISE EXCEPTION 'Return totals do not match the order and returned products';
  END IF;
  IF v_return.amount > 0 AND NOT EXISTS (
    SELECT 1 FROM ledger_entries
    WHERE tenant_id = v_return.tenant_id AND customer_id = v_order.customer_id
      AND store_id = v_order.store_id AND entry_type = 'ADJUSTMENT_CREDIT'
      AND ref_type = 'ORDER' AND ref_id = v_order.id
      AND idempotency_key = 'return:' || v_return.id::text
      AND credit = v_return.amount AND debit = 0
  ) THEN
    RAISE EXCEPTION 'Return has no matching customer ledger credit';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER order_returns_totals AFTER INSERT ON order_returns
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_check_order_return_totals();
CREATE CONSTRAINT TRIGGER order_return_items_totals AFTER INSERT ON order_return_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_check_order_return_totals();

CREATE FUNCTION app_check_order_returned_amount() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC(18,4); v_recorded NUMERIC(18,4);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM order_returns WHERE order_id = NEW.id;
  SELECT returned_amount INTO v_recorded FROM orders WHERE id = NEW.id;
  IF v_total <> v_recorded THEN
    RAISE EXCEPTION 'Order returned amount must match its immutable return records';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER orders_returned_amount_totals AFTER UPDATE ON orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (OLD.returned_amount IS DISTINCT FROM NEW.returned_amount)
  EXECUTE FUNCTION app_check_order_returned_amount();

-- Return records are immutable; reversing their credit would desynchronize the debt.
CREATE FUNCTION app_protect_order_return_credit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reverses_entry_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM ledger_entries
    WHERE id = NEW.reverses_entry_id AND tenant_id = NEW.tenant_id
      AND entry_type = 'ADJUSTMENT_CREDIT' AND ref_type = 'ORDER'
  ) THEN
    RAISE EXCEPTION 'Order return credits cannot be reversed independently';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ledger_protect_order_return_credit BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION app_protect_order_return_credit();
