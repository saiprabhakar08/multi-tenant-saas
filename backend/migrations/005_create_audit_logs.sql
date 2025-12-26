-- UP
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NULL,
  user_id UUID NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS audit_logs;
