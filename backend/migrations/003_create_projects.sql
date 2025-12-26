-- UP
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) CHECK (status IN ('active','archived','completed')) DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_user FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);

-- DOWN
DROP TABLE IF EXISTS projects;
