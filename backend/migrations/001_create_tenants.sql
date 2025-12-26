-- UP
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('active','suspended','trial')) DEFAULT 'active',
  subscription_plan VARCHAR(20) CHECK (subscription_plan IN ('free','pro','enterprise')) DEFAULT 'free',
  max_users INTEGER NOT NULL,
  max_projects INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS tenants;
