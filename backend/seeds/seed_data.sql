-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SUPER ADMIN (tenant_id = NULL)
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
VALUES (
  uuid_generate_v4(),
  NULL,
  'superadmin@system.com',
  '$2b$10$KIXzYfE2ZyYkz2k4wZQ9heR7lYF6E6WzM6UuG0w2Hh0zPqJq5c5B6', -- Admin@123
  'System Admin',
  'super_admin'
);

-- TENANT
INSERT INTO tenants (id, name, subdomain, status, subscription_plan, max_users, max_projects)
VALUES (
  uuid_generate_v4(),
  'Demo Company',
  'demo',
  'active',
  'pro',
  25,
  15
);

-- TENANT ADMIN
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
SELECT
  uuid_generate_v4(),
  t.id,
  'admin@demo.com',
  '$2b$10$u9BErN8Z5TnVbY0l5kH5wO9OeM3yqN3d7F9yRz4Kp8v4A7wF6gF8i', -- Demo@123
  'Demo Admin',
  'tenant_admin'
FROM tenants t WHERE subdomain = 'demo';

-- REGULAR USERS
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
SELECT uuid_generate_v4(), t.id, 'user1@demo.com',
'$2b$10$J9U7zUeW9s4N7Uu3Hk8d4O9yF7E1s1H1Q5zJ6Y2A0KZ9S3s4R5',
'User One', 'user'
FROM tenants t WHERE subdomain='demo';

INSERT INTO users (id, tenant_id, email, password_hash, full_name, role)
SELECT uuid_generate_v4(), t.id, 'user2@demo.com',
'$2b$10$J9U7zUeW9s4N7Uu3Hk8d4O9yF7E1s1H1Q5zJ6Y2A0KZ9S3s4R5',
'User Two', 'user'
FROM tenants t WHERE subdomain='demo';

-- PROJECTS
INSERT INTO projects (id, tenant_id, name, description, created_by)
SELECT uuid_generate_v4(), t.id, 'Project Alpha', 'First demo project', u.id
FROM tenants t
JOIN users u ON u.tenant_id = t.id AND u.role = 'tenant_admin'
WHERE t.subdomain='demo';

INSERT INTO projects (id, tenant_id, name, description, created_by)
SELECT uuid_generate_v4(), t.id, 'Project Beta', 'Second demo project', u.id
FROM tenants t
JOIN users u ON u.tenant_id = t.id AND u.role = 'tenant_admin'
WHERE t.subdomain='demo';

-- TASKS
INSERT INTO tasks (id, project_id, tenant_id, title, priority)
SELECT uuid_generate_v4(), p.id, p.tenant_id, 'Initial Task', 'high'
FROM projects p;
