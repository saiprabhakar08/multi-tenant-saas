# Architecture Diagram
```
┌─────────────────────────────────────────────────────────┐
│                      Frontend Layer                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │               React Application                     ││
│  │  ┌───────────┐ ┌───────────┐ ┌──────────────────┐  ││
│  │  │   Auth    │ │   Users   │ │    Projects      │  ││
│  │  │   Pages   │ │   Pages   │ │    & Tasks       │  ││
│  │  └───────────┘ └───────────┘ └──────────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/HTTPS
                      │ REST API Calls
┌─────────────────────▼───────────────────────────────────┐
│                   Backend Layer                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Express.js API Server                  ││
│  │  ┌───────────┐ ┌───────────┐ ┌──────────────────┐  ││
│  │  │   Auth    │ │   User    │ │   Project/Task   │  ││
│  │  │Middleware │ │   Mgmt    │ │   Controllers    │  ││
│  │  └───────────┘ └───────────┘ └──────────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ SQL Queries
                      │ Connection Pool
┌─────────────────────▼───────────────────────────────────┐
│                  Database Layer                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │               PostgreSQL Database                   ││
│  │  ┌───────────┐ ┌───────────┐ ┌──────────────────┐  ││
│  │  │  Tenants  │ │   Users   │ │ Projects/Tasks   │  ││
│  │  │   Table   │ │   Table   │ │     Tables       │  ││
│  │  └───────────┘ └───────────┘ └──────────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

Multi-Tenant SaaS Architecture
=============================
- React frontend with component-based UI
- Express.js API with JWT authentication
- PostgreSQL with tenant-scoped data isolation
- Docker containerization for deployment
```

This diagram should be saved as `architecture-overview.png` in the docs/images/ folder.
