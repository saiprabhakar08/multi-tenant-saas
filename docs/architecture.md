# System Architecture Document
## Multi-Tenant SaaS Project Management System

### Document Information
- **Version**: 1.0
- **Date**: December 26, 2025
- **Status**: Final
- **Architecture Type**: Multi-Tenant SaaS

---

## 1. Architecture Overview

### 1.1 System Context
The Multi-Tenant SaaS Project Management System is designed as a cloud-native application that serves multiple organizations (tenants) through a single shared infrastructure while maintaining complete data isolation between tenants.

### 1.2 Architecture Goals
- **Multi-Tenancy**: Efficient resource sharing with strong isolation
- **Scalability**: Horizontal and vertical scaling capabilities
- **Security**: Robust data protection and access control
- **Maintainability**: Clean separation of concerns
- **Performance**: Sub-200ms response times for core operations

### 1.3 Architecture Principles
1. **Separation of Concerns**: Clear boundaries between layers
2. **Loose Coupling**: Minimize dependencies between components
3. **High Cohesion**: Related functionality grouped together
4. **Security by Design**: Security considerations in every layer
5. **Fail-Safe Defaults**: Secure and safe default configurations

---

## 2. System Architecture Patterns

### 2.1 Multi-Tenant Architecture Pattern
**Selected Pattern**: Single Database, Tenant-Scoped Tables

```
┌─────────────────────────────────────────┐
│              Application Layer          │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   Tenant A  │  │    Tenant B     │   │
│  │   Users     │  │    Users        │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│            Shared Database              │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Users Table │  │  Projects Table │   │
│  │ tenant_id   │  │  tenant_id      │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

**Benefits**:
- Cost-effective resource sharing
- Simplified deployment and maintenance
- Good performance with proper indexing
- Moderate complexity for tenant isolation

**Trade-offs**:
- Requires careful query design for isolation
- Schema changes affect all tenants
- Performance can be impacted by large tenants

### 2.2 Layered Architecture

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │  React SPA  │  │   REST APIs     │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────┐
│          Business Logic Layer           │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Controllers │  │   Middleware    │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────┐
│           Data Access Layer             │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   Models    │  │  Database ORM   │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
                      │
┌─────────────────────────────────────────┐
│            Data Layer                   │
│         PostgreSQL Database             │
└─────────────────────────────────────────┘
```

---

## 3. Component Architecture

### 3.1 Frontend Architecture (React SPA)

```
┌─────────────────────────────────────────┐
│              React Application          │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   Pages     │  │   Components    │   │
│  │             │  │                 │   │
│  │ • Login     │  │ • UserModal     │   │
│  │ • Dashboard │  │ • ProjectCard   │   │
│  │ • Users     │  │ • TaskList      │   │
│  │ • Projects  │  │ • Header        │   │
│  │ • Tasks     │  │ • Navigation    │   │
│  └─────────────┘  └─────────────────┘   │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │  Context    │  │    Services     │   │
│  │             │  │                 │   │
│  │ • AuthCtx   │  │ • API Service   │   │
│  │ • UserCtx   │  │ • HTTP Client   │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

#### Component Responsibilities:
- **Pages**: Route-level components managing page state
- **Components**: Reusable UI elements with specific functionality
- **Context**: Global state management (authentication, user data)
- **Services**: API communication and business logic

### 3.2 Backend Architecture (Node.js/Express)

```
┌─────────────────────────────────────────┐
│            Express Application          │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │   Routes    │  │   Controllers   │   │
│  │             │  │                 │   │
│  │ • /auth     │  │ • authCtrl      │   │
│  │ • /users    │  │ • userCtrl      │   │
│  │ • /projects │  │ • projectCtrl   │   │
│  │ • /tasks    │  │ • taskCtrl      │   │
│  │ • /health   │  │ • healthCtrl    │   │
│  └─────────────┘  └─────────────────┘   │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ Middleware  │  │     Models      │   │
│  │             │  │                 │   │
│  │ • Auth      │  │ • User          │   │
│  │ • Tenant    │  │ • Tenant        │   │
│  │ • Logging   │  │ • Project       │   │
│  │ • Error     │  │ • Task          │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

#### Component Responsibilities:
- **Routes**: URL routing and request delegation
- **Controllers**: Business logic and request/response handling
- **Middleware**: Cross-cutting concerns (auth, logging, validation)
- **Models**: Data structures and database interactions

---

## 4. Data Architecture

### 4.1 Database Schema Design

```sql
-- Core Tables with Tenant Isolation

Users Table:
┌────────────┬─────────────┬───────────────┐
│ id (UUID)  │ tenant_id   │ email         │
│ password   │ full_name   │ role          │
│ is_active  │ created_at  │ updated_at    │
└────────────┴─────────────┴───────────────┘

Tenants Table:
┌────────────┬─────────────┬───────────────┐
│ id (UUID)  │ name        │ subdomain     │
│ status     │ plan        │ max_users     │
│ max_proj   │ created_at  │ updated_at    │
└────────────┴─────────────┴───────────────┘

Projects Table:
┌────────────┬─────────────┬───────────────┐
│ id (UUID)  │ tenant_id   │ name          │
│ desc       │ created_by  │ created_at    │
│ updated_at │             │               │
└────────────┴─────────────┴───────────────┘

Tasks Table:
┌────────────┬─────────────┬───────────────┐
│ id (UUID)  │ project_id  │ tenant_id     │
│ title      │ description │ priority      │
│ status     │ assigned_to │ due_date      │
│ created_by │ created_at  │ updated_at    │
└────────────┴─────────────┴───────────────┘
```

### 4.2 Tenant Isolation Strategy

#### Database-Level Isolation
```sql
-- Row-Level Security (Future Enhancement)
CREATE POLICY tenant_isolation_users ON users
    FOR ALL TO application_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Query-Level Isolation (Current Implementation)
-- All queries include tenant_id in WHERE clause
SELECT * FROM projects WHERE tenant_id = $1;
```

#### Application-Level Isolation
```javascript
// Middleware ensures tenant context in all requests
const tenantMiddleware = (req, res, next) => {
  const user = req.user;
  if (user.role !== 'super_admin' && !user.tenant_id) {
    return res.status(403).json({ error: 'No tenant access' });
  }
  req.tenant_id = user.tenant_id;
  next();
};

// All database queries scoped by tenant
const getProjects = async (tenantId) => {
  return await db.query(
    'SELECT * FROM projects WHERE tenant_id = $1',
    [tenantId]
  );
};
```

### 4.3 Data Flow Architecture

```
Frontend Request → API Gateway → Auth Middleware → Tenant Extraction → Controller → Model → Database
     ↑                                                                                        ↓
Response ← JSON Serialization ← Business Logic ← Data Validation ← Query Result ←────────────┘
```

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
┌─────────────┐    1. Login Request     ┌─────────────────┐
│   Client    │ ──────────────────────→ │   API Server    │
│  (React)    │                         │  (Express.js)   │
└─────────────┘                         └─────────────────┘
       ↑                                         │
       │                                         │ 2. Validate Credentials
       │                                         ▼
       │                                ┌─────────────────┐
       │                                │   Database      │
       │                                │ (PostgreSQL)    │
       │                                └─────────────────┘
       │                                         │
       │ 4. JWT Token Response                   │ 3. User Data
       │ ◄───────────────────────────────────────┘
       │
       │ 5. Store Token (localStorage)
       ▼
┌─────────────┐    6. Authenticated      ┌─────────────────┐
│   Client    │        Requests          │   API Server    │
│  (React)    │ ──────────────────────→ │  (Express.js)   │
│             │    (Bearer Token)        │                 │
└─────────────┘                         └─────────────────┘
```

### 5.2 Authorization Layers

#### 1. Network Level
- HTTPS/TLS encryption for all communications
- CORS configuration for cross-origin requests
- Rate limiting to prevent abuse

#### 2. Application Level
```javascript
// JWT Middleware
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Role-based Authorization
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

#### 3. Data Level
- Tenant-scoped queries prevent cross-tenant access
- Input validation and sanitization
- Parameterized queries prevent SQL injection

### 5.3 Security Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                   Internet                              │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS/TLS
┌─────────────────────▼───────────────────────────────────┐
│                Load Balancer                            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Application Server                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │
│  │    Auth     │ │   Tenant    │ │   Role Check    │    │
│  │ Middleware  │ │ Extraction  │ │   Middleware    │    │
│  └─────────────┘ └─────────────┘ └─────────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │ Tenant-scoped queries
┌─────────────────────▼───────────────────────────────────┐
│                  Database                               │
│         (Row-level security policies)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Deployment Architecture

### 6.1 Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Docker Host                              │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Frontend   │  │   Backend   │  │    Database     │  │
│  │ Container   │  │  Container  │  │   Container     │  │
│  │             │  │             │  │                 │  │
│  │ React App   │  │ Express.js  │  │  PostgreSQL     │  │
│  │ Port: 3000  │  │ Port: 5000  │  │  Port: 5432     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│         │                │                  │           │
│         └────────────────┼──────────────────┘           │
│                          │                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Docker Network: app-network               │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Docker Compose Configuration

```yaml
# docker-compose.yml architecture
services:
  database:
    - PostgreSQL 13
    - Persistent volume for data
    - Health checks
    - Environment variables for configuration
    
  backend:
    - Node.js application
    - Depends on database
    - Environment variables for secrets
    - Port mapping: 5000:5000
    
  frontend:
    - React build served by nginx
    - Port mapping: 3000:80
    - Proxy configuration for API calls

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

### 6.3 Production Deployment Considerations

#### Scalability Architecture
```
┌─────────────────────────────────────────────────────────┐
│                  Load Balancer                         │
│               (nginx/HAProxy)                           │
└─────────────────┬───┬───┬───────────────────────────────┘
                  │   │   │
    ┌─────────────┘   │   └─────────────┐
    │                 │                 │
┌───▼────┐       ┌───▼────┐       ┌───▼────┐
│App     │       │App     │       │App     │
│Server 1│       │Server 2│       │Server N│
└────────┘       └────────┘       └────────┘
    │                 │                 │
    └─────────────┬───┴─────────────────┘
                  │
            ┌─────▼─────┐
            │ Database  │
            │ Cluster   │
            └───────────┘
```

#### Database Architecture for Scale
```
┌─────────────────────────────────────────────────────────┐
│                Master Database                          │
│              (Read/Write)                               │
└─────────────────┬───────────────────────────────────────┘
                  │ Replication
    ┌─────────────┴─────────────┐
    │                           │
┌───▼─────────┐         ┌─────▼─────────┐
│Read Replica │         │ Read Replica  │
│     #1      │         │      #2       │
│ (Read Only) │         │ (Read Only)   │
└─────────────┘         └───────────────┘
```

---

## 7. Performance Architecture

### 7.1 Caching Strategy

```
┌─────────────────────────────────────────────────────────┐
│                   Client Browser                        │
│              (Browser Cache - Static Assets)            │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                   CDN Layer                             │
│         (Static Assets, Images, JS, CSS)                │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              Application Server                         │
│  ┌─────────────┐         ┌─────────────────────────────┐ │
│  │   Memory    │         │        Redis Cache          │ │
│  │   Cache     │         │    (Sessions, API Cache)    │ │
│  │ (In-Process)│         │                             │ │
│  └─────────────┘         └─────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                  Database                               │
│           (Query Optimization, Indexing)                │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Database Performance

#### Indexing Strategy
```sql
-- Primary Performance Indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- Composite Indexes for Common Queries
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_projects_tenant_created ON projects(tenant_id, created_at);
```

#### Query Optimization Patterns
```javascript
// Efficient tenant-scoped queries
const getUserProjects = async (userId, tenantId) => {
  return await db.query(`
    SELECT p.*, COUNT(t.id) as task_count
    FROM projects p
    LEFT JOIN tasks t ON p.id = t.project_id
    WHERE p.tenant_id = $1
    AND (p.created_by = $2 OR $2 IN (
      SELECT user_id FROM project_members WHERE project_id = p.id
    ))
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [tenantId, userId]);
};
```

---

## 8. Monitoring & Observability

### 8.1 Application Monitoring

```
┌─────────────────────────────────────────────────────────┐
│              Application Metrics                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Response   │  │   Error     │  │   Throughput    │  │
│  │    Time     │  │   Rates     │  │    (RPS)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│               Health Check Endpoints                    │
│                                                         │
│  GET /api/health                                        │
│  - Database connectivity                                │
│  - Application status                                   │
│  - Memory usage                                         │
│  - Uptime information                                   │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Error Handling & Logging

```javascript
// Centralized Error Handling
const errorHandler = (err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    tenant: req.tenant_id,
    user: req.user?.id,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Structured Logging
const logger = {
  info: (data) => console.log(JSON.stringify({ level: 'info', ...data })),
  error: (data) => console.error(JSON.stringify({ level: 'error', ...data })),
  warn: (data) => console.warn(JSON.stringify({ level: 'warn', ...data }))
};
```

---

## 9. API Architecture

### 9.1 RESTful API Design

```
API Versioning Strategy:
/api/v1/...  (Current version)
/api/v2/...  (Future versions)

Resource-based URLs:
GET    /api/v1/tenants/:id/users        # List tenant users
POST   /api/v1/users                    # Create user
GET    /api/v1/users/:id                # Get user details
PUT    /api/v1/users/:id                # Update user
DELETE /api/v1/users/:id                # Delete user

GET    /api/v1/projects                 # List projects (tenant-scoped)
POST   /api/v1/projects                 # Create project
GET    /api/v1/projects/:id             # Get project details
PUT    /api/v1/projects/:id             # Update project
DELETE /api/v1/projects/:id             # Delete project

GET    /api/v1/tasks                    # List tasks (tenant-scoped)
POST   /api/v1/tasks                    # Create task
GET    /api/v1/tasks/:id                # Get task details
PUT    /api/v1/tasks/:id                # Update task
DELETE /api/v1/tasks/:id                # Delete task
```

### 9.2 API Response Format

```javascript
// Success Response Format
{
  "success": true,
  "data": {
    // Resource data or array of resources
  },
  "meta": {
    "total": 100,      // For paginated results
    "page": 1,         // Current page
    "limit": 20        // Items per page
  }
}

// Error Response Format
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND",
  "details": {
    // Additional error context
  }
}

// Validation Error Format
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": ["Email is required", "Email must be valid"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

---

## 10. Future Architecture Considerations

### 10.1 Microservices Migration Path

```
Current Monolithic Architecture:
┌─────────────────────────────────────────┐
│          Single Application             │
│    ┌─────────┬─────────┬─────────┐      │
│    │  Auth   │Projects │  Tasks  │      │
│    └─────────┴─────────┴─────────┘      │
└─────────────────────────────────────────┘
              │
              ▼
Future Microservices Architecture:
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│Auth Service │ │Project Mgmt │ │Task Service │
│             │ │  Service    │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
       │               │               │
       └───────────────┼───────────────┘
                       │
                ┌─────────────┐
                │   Gateway   │
                │  (API GW)   │
                └─────────────┘
```

### 10.2 Event-Driven Architecture

```
┌─────────────┐    Events     ┌─────────────────┐
│ User Action │──────────────→│  Event Bus      │
│             │               │ (Redis/RabbitMQ)│
└─────────────┘               └─────────────────┘
                                       │
                              ┌────────┴────────┐
                              │                 │
                    ┌─────────▼─────┐  ┌────────▼────────┐
                    │ Notification  │  │   Audit Log     │
                    │   Service     │  │   Service       │
                    └───────────────┘  └─────────────────┘
```

### 10.3 Database Sharding Strategy

```
Current: Single Database
┌─────────────────────────────────────────┐
│            PostgreSQL                   │
│  ┌─────────────────┐ ┌─────────────────┐│
│  │   Tenant A      │ │   Tenant B      ││
│  │   Data          │ │   Data          ││
│  └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────┘

Future: Tenant-based Sharding
┌─────────────────┐     ┌─────────────────┐
│    Shard 1      │     │    Shard 2      │
│  PostgreSQL     │     │  PostgreSQL     │
│ ┌─────────────┐ │     │ ┌─────────────┐ │
│ │  Tenants    │ │     │ │  Tenants    │ │
│ │  A, B, C    │ │     │ │  D, E, F    │ │
│ └─────────────┘ │     │ └─────────────┘ │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌─────────────┐
              │  Shard      │
              │  Router     │
              └─────────────┘
```

---

## 11. Architecture Decision Records (ADRs)

### ADR-001: Multi-Tenant Database Strategy
**Decision**: Use single database with tenant-scoped tables
**Rationale**: Balance between cost efficiency and data isolation
**Alternatives Considered**: Separate databases per tenant, shared schema
**Trade-offs**: Query complexity vs. infrastructure costs

### ADR-002: Frontend Framework Selection
**Decision**: React with functional components and hooks
**Rationale**: Large ecosystem, team familiarity, component reusability
**Alternatives Considered**: Vue.js, Angular
**Trade-offs**: Learning curve vs. development velocity

### ADR-003: Authentication Strategy
**Decision**: JWT tokens with bcrypt password hashing
**Rationale**: Stateless authentication, scalability, security
**Alternatives Considered**: Session-based auth, OAuth integration
**Trade-offs**: Token management vs. server-side session storage

### ADR-004: API Design Pattern
**Decision**: RESTful APIs with JSON responses
**Rationale**: Industry standard, client compatibility, simplicity
**Alternatives Considered**: GraphQL, gRPC
**Trade-offs**: Flexibility vs. complexity

---

## 12. Architecture Compliance

### 12.1 Quality Attributes Fulfillment

| Quality Attribute | Implementation | Measurement |
|------------------|----------------|-------------|
| **Scalability** | Horizontal scaling, database indexing | Support 1000+ users |
| **Security** | JWT, HTTPS, tenant isolation | Zero security incidents |
| **Performance** | Caching, query optimization | <200ms response time |
| **Reliability** | Error handling, health checks | 99.9% uptime |
| **Maintainability** | Modular code, documentation | Low defect rate |

### 12.2 Architecture Governance

#### Code Review Checklist
- [ ] Tenant isolation properly implemented
- [ ] Security middleware applied
- [ ] Error handling included
- [ ] Database queries optimized
- [ ] Input validation implemented
- [ ] Logging and monitoring added

#### Architecture Validation
- Regular security audits
- Performance testing
- Database query analysis
- Code complexity metrics
- Dependency vulnerability scans

---

**Document Approval:**
- Solution Architect: [Signature Required]
- Security Architect: [Signature Required]
- Lead Developer: [Signature Required]
- DevOps Engineer: [Signature Required]
