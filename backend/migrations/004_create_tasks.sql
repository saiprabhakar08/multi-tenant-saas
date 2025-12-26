-- UP
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) CHECK (status IN ('todo','in_progress','completed')) DEFAULT 'todo',
  priority VARCHAR(10) CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  assigned_to UUID NULL,
  due_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_project FOREIGN KEY (project_id)
    REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_user FOREIGN KEY (assigned_to)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_tenant_project ON tasks(tenant_id, project_id);

-- DOWN
DROP TABLE IF EXISTS tasks;
