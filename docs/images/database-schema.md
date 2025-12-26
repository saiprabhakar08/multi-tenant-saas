# Database Schema Diagram
```
┌─────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                     │
└─────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────────────────┐
│     TENANTS      │       │           USERS              │
│                  │       │                              │
│ • id (UUID, PK)  │ ◄────┐│ • id (UUID, PK)              │
│ • name           │      ││ • tenant_id (FK → tenants.id)│
│ • subdomain      │      ││ • email (UNIQUE)             │
│ • status         │      ││ • password_hash              │
│ • plan           │      ││ • full_name                  │
│ • max_users      │      ││ • role (enum)                │
│ • max_projects   │      ││ • is_active                  │
│ • created_at     │      ││ • created_at                 │
│ • updated_at     │      ││ • updated_at                 │
└──────────────────┘      │└──────────────────────────────┘
                          │
                          │
┌─────────────────────────▼───────────────────────────────┐
│                    PROJECTS                             │
│                                                         │
│ • id (UUID, PK)                                         │
│ • tenant_id (FK → tenants.id)                           │
│ • name                                                  │
│ • description                                           │
│ • created_by (FK → users.id)                            │
│ • is_active                                             │
│ • created_at                                            │
│ • updated_at                                            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │
┌─────────────────────▼───────────────────────────────────┐
│                     TASKS                               │
│                                                         │
│ • id (UUID, PK)                                         │
│ • project_id (FK → projects.id)                         │
│ • tenant_id (FK → tenants.id)                           │
│ • title                                                 │
│ • description                                           │
│ • priority (enum: low, medium, high, urgent)            │
│ • status (enum: pending, in_progress, completed)        │
│ • assigned_to (FK → users.id)                           │
│ • due_date                                              │
│ • created_by (FK → users.id)                            │
│ • completed_at                                          │
│ • created_at                                            │
│ • updated_at                                            │
└─────────────────────────────────────────────────────────┘

RELATIONSHIPS:
=============
• One Tenant has many Users (1:N)
• One Tenant has many Projects (1:N)
• One Project has many Tasks (1:N)
• One User can create many Projects (1:N)
• One User can be assigned many Tasks (1:N)
• One User can create many Tasks (1:N)

KEY CONSTRAINTS:
================
• All tenant_id foreign keys ensure data isolation
• Super admins have tenant_id = NULL
• Email addresses are globally unique
• Project names are unique within tenant
• Cascade deletes maintain referential integrity
```

This diagram should be saved as `database-schema.png` in the docs/images/ folder.
