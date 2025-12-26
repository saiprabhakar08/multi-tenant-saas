# Technical Specification Document
## Multi-Tenant SaaS Project Management System

### Document Information
- **Version**: 1.0
- **Date**: December 26, 2025
- **Status**: Final
- **Technical Lead**: Development Team

---

## 1. Technical Overview

### 1.1 System Purpose
The Multi-Tenant SaaS Project Management System is a web-based application that enables multiple organizations (tenants) to manage their projects and tasks through a shared infrastructure while maintaining complete data isolation and security.

### 1.2 Technical Goals
- **Multi-Tenant Architecture**: Efficient resource sharing with strict tenant isolation
- **High Performance**: Sub-200ms API response times for 95% of requests
- **Scalability**: Support for 1,000+ concurrent users
- **Security**: Zero-trust security model with robust authentication and authorization
- **Maintainability**: Clean, well-documented, and testable codebase

### 1.3 Technology Stack

#### Frontend Stack
- **Framework**: React 18.2.0
- **Language**: JavaScript (ES2022)
- **Build Tool**: Create React App
- **HTTP Client**: Axios 1.x
- **State Management**: React Context API
- **Styling**: CSS3 with responsive design

#### Backend Stack
- **Runtime**: Node.js 18.x LTS
- **Framework**: Express.js 4.x
- **Language**: JavaScript (ES2022)
- **Authentication**: JSON Web Tokens (JWT)
- **Password Hashing**: bcrypt
- **Database Driver**: node-postgres (pg)

#### Database Stack
- **Database**: PostgreSQL 13.x
- **Connection Pooling**: pg-pool
- **Extensions**: uuid-ossp for UUID generation

#### Infrastructure Stack
- **Containerization**: Docker & Docker Compose
- **Web Server**: nginx (production)
- **Process Management**: PM2 (production)

---

## 2. System Requirements

### 2.1 Functional Requirements

#### Authentication & Authorization (AUTH)
- **AUTH-001**: JWT-based stateless authentication
- **AUTH-002**: Role-based access control (super_admin, tenant_admin, user)
- **AUTH-003**: Secure password storage with bcrypt (min 10 rounds)
- **AUTH-004**: Token expiration and refresh mechanism

#### Multi-Tenancy (TENANT)
- **TENANT-001**: Complete data isolation between tenants
- **TENANT-002**: Tenant-scoped API endpoints
- **TENANT-003**: Database-level tenant isolation
- **TENANT-004**: Cross-tenant access prevention

#### User Management (USER)
- **USER-001**: CRUD operations for user accounts
- **USER-002**: User role assignment and management
- **USER-003**: User profile management
- **USER-004**: User status management (active/inactive)

#### Project Management (PROJECT)
- **PROJECT-001**: CRUD operations for projects
- **PROJECT-002**: Project-user associations
- **PROJECT-003**: Project metadata tracking
- **PROJECT-004**: Tenant-scoped project access

#### Task Management (TASK)
- **TASK-001**: CRUD operations for tasks
- **TASK-002**: Task-project associations
- **TASK-003**: Task assignment and status tracking
- **TASK-004**: Priority and due date management

### 2.2 Non-Functional Requirements

#### Performance (PERF)
- **PERF-001**: API response time < 200ms for 95% of requests
- **PERF-002**: Database query optimization with proper indexing
- **PERF-003**: Frontend page load time < 3 seconds
- **PERF-004**: Support 1,000+ concurrent users

#### Security (SEC)
- **SEC-001**: All communication over HTTPS/TLS
- **SEC-002**: Input validation and sanitization
- **SEC-003**: SQL injection prevention
- **SEC-004**: XSS and CSRF protection

#### Reliability (REL)
- **REL-001**: 99.9% system uptime
- **REL-002**: Graceful error handling and recovery
- **REL-003**: Database backup and recovery procedures
- **REL-004**: Health monitoring and alerting

#### Scalability (SCALE)
- **SCALE-001**: Horizontal scaling capability
- **SCALE-002**: Database connection pooling
- **SCALE-003**: Stateless application design
- **SCALE-004**: Caching strategy implementation

---

## 3. Database Design

### 3.1 Entity Relationship Diagram

```sql
-- Entity Definitions with Relationships

TENANTS (1) ────────── (0..N) USERS
   │                            │
   │                            │
   └── (1) ─────────── (0..N) PROJECTS
                            │
                            │
                       (1) ─┴── (0..N) TASKS
```

### 3.2 Table Definitions

#### 3.2.1 Tenants Table
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    max_users INTEGER DEFAULT 10,
    max_projects INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);
```

#### 3.2.2 Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'tenant_admin', 'user')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Super admins have null tenant_id
    CONSTRAINT valid_tenant_role CHECK (
        (role = 'super_admin' AND tenant_id IS NULL) OR
        (role != 'super_admin' AND tenant_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active_tenant ON users(tenant_id, is_active);
```

#### 3.2.3 Projects Table
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure project name is unique within tenant
    UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_tenant_active ON projects(tenant_id, is_active);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

#### 3.2.4 Tasks Table
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    created_by UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
```

### 3.3 Database Constraints and Triggers

#### 3.3.1 Data Consistency Triggers
```sql
-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 3.3.2 Tenant Isolation Constraints
```sql
-- Ensure tasks belong to the same tenant as their project
ALTER TABLE tasks ADD CONSTRAINT tasks_tenant_consistency 
CHECK (
    tenant_id = (SELECT tenant_id FROM projects WHERE id = project_id)
);

-- Ensure assigned users belong to the same tenant as the task
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_user_tenant 
CHECK (
    assigned_to IS NULL OR 
    tenant_id = (SELECT tenant_id FROM users WHERE id = assigned_to)
);
```

### 3.4 Database Connection Configuration

```javascript
// config/database.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'multitenant_saas',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    
    // Connection pool settings
    min: 2,                    // Minimum connections
    max: 20,                   // Maximum connections
    acquireTimeoutMillis: 60000,   // 60 seconds
    createTimeoutMillis: 30000,    // 30 seconds
    destroyTimeoutMillis: 5000,    // 5 seconds
    idleTimeoutMillis: 30000,      // 30 seconds
    reapIntervalMillis: 1000,      // 1 second
    createRetryIntervalMillis: 200, // 200ms
    
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

// Health check function
const checkDbConnection = async () => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return { status: 'connected' };
    } catch (error) {
        console.error('Database connection error:', error);
        return { status: 'disconnected', error: error.message };
    }
};

module.exports = { pool, checkDbConnection };
```

---

## 4. API Specification

### 4.1 API Design Principles

#### RESTful Design
- **Resource-based URLs**: Nouns, not verbs
- **HTTP methods**: GET, POST, PUT, DELETE
- **Status codes**: Appropriate HTTP status codes
- **Idempotency**: Safe operations are idempotent

#### Response Format
```javascript
// Success Response
{
    "success": true,
    "data": { /* resource data */ },
    "meta": {
        "timestamp": "2025-12-26T10:00:00Z",
        "version": "1.0"
    }
}

// Error Response
{
    "success": false,
    "error": "Error description",
    "code": "ERROR_CODE",
    "meta": {
        "timestamp": "2025-12-26T10:00:00Z",
        "version": "1.0"
    }
}

// Validation Error Response
{
    "success": false,
    "error": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
        "field_name": ["Error message 1", "Error message 2"]
    },
    "meta": {
        "timestamp": "2025-12-26T10:00:00Z",
        "version": "1.0"
    }
}
```

### 4.2 Authentication API

#### POST /api/auth/login
```javascript
// Request
{
    "email": "user@example.com",
    "password": "password123"
}

// Success Response (200)
{
    "success": true,
    "data": {
        "token": "jwt_token_string",
        "user": {
            "id": "uuid",
            "email": "user@example.com",
            "full_name": "John Doe",
            "role": "tenant_admin",
            "tenant_id": "tenant_uuid"
        },
        "expires_in": 3600
    }
}

// Error Response (401)
{
    "success": false,
    "error": "Invalid email or password",
    "code": "INVALID_CREDENTIALS"
}
```

#### GET /api/auth/me
```javascript
// Headers: Authorization: Bearer <token>

// Success Response (200)
{
    "success": true,
    "data": {
        "id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "role": "tenant_admin",
        "tenant_id": "tenant_uuid",
        "is_active": true,
        "last_login": "2025-12-26T09:00:00Z"
    }
}
```

### 4.3 User Management API

#### GET /api/tenants/:tenantId/users
```javascript
// Headers: Authorization: Bearer <token>

// Success Response (200)
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "email": "user@example.com",
            "full_name": "John Doe",
            "role": "user",
            "is_active": true,
            "created_at": "2025-12-26T08:00:00Z"
        }
    ]
}
```

#### POST /api/users
```javascript
// Request
{
    "email": "newuser@example.com",
    "password": "password123",
    "full_name": "Jane Smith",
    "role": "user"
}

// Success Response (201)
{
    "success": true,
    "data": {
        "id": "new_uuid",
        "email": "newuser@example.com",
        "full_name": "Jane Smith",
        "role": "user",
        "tenant_id": "tenant_uuid",
        "is_active": true,
        "created_at": "2025-12-26T10:00:00Z"
    }
}
```

### 4.4 Project Management API

#### GET /api/projects
```javascript
// Query Parameters: ?page=1&limit=20&search=project_name

// Success Response (200)
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "name": "Project Alpha",
            "description": "Description here",
            "created_by": "user_uuid",
            "created_by_name": "John Doe",
            "is_active": true,
            "created_at": "2025-12-26T08:00:00Z",
            "task_count": 5,
            "completed_task_count": 2
        }
    ],
    "meta": {
        "total": 10,
        "page": 1,
        "limit": 20,
        "pages": 1
    }
}
```

#### POST /api/projects
```javascript
// Request
{
    "name": "New Project",
    "description": "Project description"
}

// Success Response (201)
{
    "success": true,
    "data": {
        "id": "new_uuid",
        "name": "New Project",
        "description": "Project description",
        "created_by": "user_uuid",
        "tenant_id": "tenant_uuid",
        "is_active": true,
        "created_at": "2025-12-26T10:00:00Z"
    }
}
```

### 4.5 Task Management API

#### GET /api/tasks
```javascript
// Query Parameters: ?project_id=uuid&status=pending&assigned_to=uuid

// Success Response (200)
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "Task Title",
            "description": "Task description",
            "priority": "high",
            "status": "in_progress",
            "project_id": "project_uuid",
            "project_name": "Project Alpha",
            "assigned_to": "user_uuid",
            "assigned_to_name": "John Doe",
            "due_date": "2025-12-30",
            "created_by": "creator_uuid",
            "created_by_name": "Jane Smith",
            "created_at": "2025-12-26T08:00:00Z"
        }
    ]
}
```

#### POST /api/tasks
```javascript
// Request
{
    "title": "New Task",
    "description": "Task description",
    "project_id": "project_uuid",
    "priority": "medium",
    "assigned_to": "user_uuid",
    "due_date": "2025-12-30"
}

// Success Response (201)
{
    "success": true,
    "data": {
        "id": "new_uuid",
        "title": "New Task",
        "description": "Task description",
        "project_id": "project_uuid",
        "tenant_id": "tenant_uuid",
        "priority": "medium",
        "status": "pending",
        "assigned_to": "user_uuid",
        "due_date": "2025-12-30",
        "created_by": "user_uuid",
        "created_at": "2025-12-26T10:00:00Z"
    }
}
```

### 4.6 System API

#### GET /api/health
```javascript
// Success Response (200)
{
    "status": "ok",
    "database": "connected",
    "timestamp": "2025-12-26T10:00:00Z",
    "uptime": 86400,
    "version": "1.0.0"
}

// Error Response (503)
{
    "status": "error",
    "database": "disconnected",
    "error": "Connection timeout",
    "timestamp": "2025-12-26T10:00:00Z"
}
```

---

## 5. Security Implementation

### 5.1 Authentication Implementation

#### JWT Configuration
```javascript
// config/jwt.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const generateToken = (user) => {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id
    };
    
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'multitenant-saas',
        audience: 'multitenant-saas-users'
    });
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'multitenant-saas',
            audience: 'multitenant-saas-users'
        });
    } catch (error) {
        throw new Error('Invalid token');
    }
};

module.exports = { generateToken, verifyToken };
```

#### Password Hashing
```javascript
// utils/password.js
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
        errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = { hashPassword, comparePassword, validatePassword };
```

### 5.2 Middleware Implementation

#### Authentication Middleware
```javascript
// middleware/auth.js
const { verifyToken } = require('../config/jwt');
const { pool } = require('../config/database');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token is required',
                code: 'TOKEN_REQUIRED'
            });
        }
        
        const decoded = verifyToken(token);
        
        // Verify user still exists and is active
        const userQuery = `
            SELECT id, email, full_name, role, tenant_id, is_active 
            FROM users 
            WHERE id = $1 AND is_active = true
        `;
        const userResult = await pool.query(userQuery, [decoded.id]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found or inactive',
                code: 'USER_INACTIVE'
            });
        }
        
        req.user = userResult.rows[0];
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
        });
    }
};

module.exports = { authenticateToken };
```

#### Authorization Middleware
```javascript
// middleware/authorization.js
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user.role;
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        next();
    };
};

const requireTenantAccess = async (req, res, next) => {
    const user = req.user;
    
    // Super admins can access any tenant
    if (user.role === 'super_admin') {
        return next();
    }
    
    // Extract tenant context from request
    const tenantId = req.params.tenantId || 
                    req.body.tenant_id || 
                    user.tenant_id;
    
    // Verify user belongs to the tenant
    if (user.tenant_id !== tenantId) {
        return res.status(403).json({
            success: false,
            error: 'Access denied to tenant resources',
            code: 'TENANT_ACCESS_DENIED'
        });
    }
    
    req.tenant_id = tenantId;
    next();
};

module.exports = { requireRole, requireTenantAccess };
```

### 5.3 Input Validation

#### Validation Middleware
```javascript
// middleware/validation.js
const validator = require('validator');

const validateEmail = (email) => {
    if (!email || !validator.isEmail(email)) {
        return 'Valid email address is required';
    }
    return null;
};

const validateUUID = (id, fieldName = 'ID') => {
    if (!id || !validator.isUUID(id)) {
        return `${fieldName} must be a valid UUID`;
    }
    return null;
};

const validateString = (str, fieldName, minLength = 1, maxLength = 255) => {
    if (!str || typeof str !== 'string') {
        return `${fieldName} is required`;
    }
    if (str.length < minLength) {
        return `${fieldName} must be at least ${minLength} characters`;
    }
    if (str.length > maxLength) {
        return `${fieldName} must be no more than ${maxLength} characters`;
    }
    return null;
};

const validateEnum = (value, allowedValues, fieldName) => {
    if (!allowedValues.includes(value)) {
        return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
    }
    return null;
};

const validateUser = (userData) => {
    const errors = {};
    
    const emailError = validateEmail(userData.email);
    if (emailError) errors.email = [emailError];
    
    const nameError = validateString(userData.full_name, 'Full name', 1, 255);
    if (nameError) errors.full_name = [nameError];
    
    const roleError = validateEnum(userData.role, 
        ['super_admin', 'tenant_admin', 'user'], 'Role');
    if (roleError) errors.role = [roleError];
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

const validateProject = (projectData) => {
    const errors = {};
    
    const nameError = validateString(projectData.name, 'Project name', 1, 255);
    if (nameError) errors.name = [nameError];
    
    if (projectData.description && projectData.description.length > 2000) {
        errors.description = ['Description must be no more than 2000 characters'];
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

const validateTask = (taskData) => {
    const errors = {};
    
    const titleError = validateString(taskData.title, 'Task title', 1, 255);
    if (titleError) errors.title = [titleError];
    
    const projectIdError = validateUUID(taskData.project_id, 'Project ID');
    if (projectIdError) errors.project_id = [projectIdError];
    
    if (taskData.priority) {
        const priorityError = validateEnum(taskData.priority, 
            ['low', 'medium', 'high', 'urgent'], 'Priority');
        if (priorityError) errors.priority = [priorityError];
    }
    
    if (taskData.status) {
        const statusError = validateEnum(taskData.status, 
            ['pending', 'in_progress', 'completed', 'cancelled'], 'Status');
        if (statusError) errors.status = [statusError];
    }
    
    if (taskData.due_date && !validator.isDate(taskData.due_date)) {
        errors.due_date = ['Due date must be a valid date'];
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

module.exports = {
    validateEmail,
    validateUUID,
    validateString,
    validateEnum,
    validateUser,
    validateProject,
    validateTask
};
```

---

## 6. Frontend Implementation

### 6.1 React Application Structure

```
src/
├── components/          # Reusable components
│   ├── UserModal.js    # User add/edit modal
│   ├── Loading.js      # Loading spinner
│   ├── ErrorBoundary.js # Error boundary
│   └── ProtectedRoute.js # Route protection
├── context/            # React context providers
│   └── AuthContext.js  # Authentication context
├── pages/              # Page components
│   ├── Login.js        # Login page
│   ├── Dashboard.js    # Dashboard page
│   ├── Users.js        # User management
│   ├── Projects.js     # Project management
│   └── Tasks.js        # Task management
├── services/           # API services
│   ├── api.js          # Axios configuration
│   ├── authService.js  # Authentication API
│   ├── userService.js  # User API
│   ├── projectService.js # Project API
│   └── taskService.js  # Task API
├── utils/              # Utility functions
│   ├── constants.js    # Application constants
│   ├── helpers.js      # Helper functions
│   └── storage.js      # Local storage utilities
├── styles/             # CSS files
│   ├── global.css      # Global styles
│   └── components.css  # Component styles
├── App.js              # Main application component
└── index.js            # Application entry point
```

### 6.2 API Service Layer

#### API Configuration
```javascript
// services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
```

#### Authentication Service
```javascript
// services/authService.js
import api from './api';

export const authService = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.success) {
            const { token, user } = response.data.data;
            localStorage.setItem('token', token);
            return { token, user };
        }
        throw new Error(response.data.error);
    },

    logout: () => {
        localStorage.removeItem('token');
    },

    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        return response.data.data;
    },

    isAuthenticated: () => {
        const token = localStorage.getItem('token');
        return !!token;
    }
};
```

### 6.3 State Management

#### Authentication Context
```javascript
// context/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

const authReducer = (state, action) => {
    switch (action.type) {
        case 'LOGIN_START':
            return { ...state, loading: true, error: null };
        case 'LOGIN_SUCCESS':
            return { 
                ...state, 
                loading: false, 
                isAuthenticated: true, 
                user: action.payload.user 
            };
        case 'LOGIN_FAILURE':
            return { 
                ...state, 
                loading: false, 
                isAuthenticated: false, 
                error: action.payload 
            };
        case 'LOGOUT':
            return { 
                ...state, 
                isAuthenticated: false, 
                user: null, 
                error: null 
            };
        case 'SET_USER':
            return { ...state, user: action.payload, isAuthenticated: true };
        default:
            return state;
    }
};

const initialState = {
    isAuthenticated: false,
    user: null,
    loading: false,
    error: null,
};

export const AuthProvider = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);

    useEffect(() => {
        const initAuth = async () => {
            if (authService.isAuthenticated()) {
                try {
                    const user = await authService.getCurrentUser();
                    dispatch({ type: 'SET_USER', payload: user });
                } catch (error) {
                    authService.logout();
                }
            }
        };
        initAuth();
    }, []);

    const login = async (email, password) => {
        dispatch({ type: 'LOGIN_START' });
        try {
            const { user } = await authService.login(email, password);
            dispatch({ type: 'LOGIN_SUCCESS', payload: { user } });
            return user;
        } catch (error) {
            dispatch({ type: 'LOGIN_FAILURE', payload: error.message });
            throw error;
        }
    };

    const logout = () => {
        authService.logout();
        dispatch({ type: 'LOGOUT' });
    };

    return (
        <AuthContext.Provider value={{
            ...state,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
```

### 6.4 Component Implementation Examples

#### Protected Route Component
```javascript
// components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user?.role !== requiredRole) {
        return <div>Access Denied: Insufficient permissions</div>;
    }

    return children;
};

export default ProtectedRoute;
```

#### Error Boundary Component
```javascript
// components/ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h2>Something went wrong</h2>
                    <p>We apologize for the inconvenience. Please refresh the page.</p>
                    <button onClick={() => window.location.reload()}>
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
```

---

## 7. Testing Strategy

### 7.1 Backend Testing

#### Unit Tests (Jest)
```javascript
// tests/unit/auth.test.js
const { hashPassword, comparePassword, validatePassword } = require('../../utils/password');
const { generateToken, verifyToken } = require('../../config/jwt');

describe('Password Utils', () => {
    test('should hash and compare password correctly', async () => {
        const password = 'testPassword123!';
        const hashedPassword = await hashPassword(password);
        
        expect(hashedPassword).not.toBe(password);
        expect(await comparePassword(password, hashedPassword)).toBe(true);
        expect(await comparePassword('wrongPassword', hashedPassword)).toBe(false);
    });

    test('should validate password strength', () => {
        const weakPassword = '123';
        const strongPassword = 'TestPass123!';
        
        const weakResult = validatePassword(weakPassword);
        const strongResult = validatePassword(strongPassword);
        
        expect(weakResult.isValid).toBe(false);
        expect(weakResult.errors.length).toBeGreaterThan(0);
        expect(strongResult.isValid).toBe(true);
        expect(strongResult.errors.length).toBe(0);
    });
});

describe('JWT Utils', () => {
    test('should generate and verify token correctly', () => {
        const user = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'test@example.com',
            role: 'user',
            tenant_id: '123e4567-e89b-12d3-a456-426614174001'
        };
        
        const token = generateToken(user);
        const decoded = verifyToken(token);
        
        expect(decoded.id).toBe(user.id);
        expect(decoded.email).toBe(user.email);
        expect(decoded.role).toBe(user.role);
    });
});
```

#### Integration Tests
```javascript
// tests/integration/api.test.js
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../config/database');

describe('Authentication API', () => {
    afterAll(async () => {
        await pool.end();
    });

    test('POST /api/auth/login should authenticate user', async () => {
        const loginData = {
            email: 'admin@demo.com',
            password: 'Demo@123'
        };

        const response = await request(app)
            .post('/api/auth/login')
            .send(loginData)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data.user.email).toBe(loginData.email);
    });

    test('POST /api/auth/login should reject invalid credentials', async () => {
        const loginData = {
            email: 'admin@demo.com',
            password: 'wrongpassword'
        };

        const response = await request(app)
            .post('/api/auth/login')
            .send(loginData)
            .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
});
```

### 7.2 Frontend Testing

#### Component Tests (React Testing Library)
```javascript
// src/components/__tests__/UserModal.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserModal from '../UserModal';
import { AuthProvider } from '../../context/AuthContext';

const mockUser = {
    id: '1',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user'
};

const renderWithAuth = (component) => {
    return render(
        <AuthProvider>
            {component}
        </AuthProvider>
    );
};

describe('UserModal', () => {
    test('should render add user form when no user provided', () => {
        renderWithAuth(
            <UserModal 
                isOpen={true} 
                onClose={() => {}} 
                onUserSaved={() => {}} 
            />
        );

        expect(screen.getByText('Add New User')).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });

    test('should render edit user form when user provided', () => {
        renderWithAuth(
            <UserModal 
                isOpen={true} 
                onClose={() => {}} 
                onUserSaved={() => {}} 
                user={mockUser}
            />
        );

        expect(screen.getByText('Edit User')).toBeInTheDocument();
        expect(screen.getByDisplayValue(mockUser.email)).toBeInTheDocument();
        expect(screen.getByDisplayValue(mockUser.full_name)).toBeInTheDocument();
    });

    test('should validate required fields', async () => {
        const onUserSaved = jest.fn();
        
        renderWithAuth(
            <UserModal 
                isOpen={true} 
                onClose={() => {}} 
                onUserSaved={onUserSaved} 
            />
        );

        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/email is required/i)).toBeInTheDocument();
            expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
        });

        expect(onUserSaved).not.toHaveBeenCalled();
    });
});
```

### 7.3 Security Testing

#### SQL Injection Tests
```javascript
// tests/security/sql-injection.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in login', async () => {
        const maliciousInput = {
            email: "admin@demo.com'; DROP TABLE users; --",
            password: "password"
        };

        const response = await request(app)
            .post('/api/auth/login')
            .send(maliciousInput)
            .expect(401);

        expect(response.body.success).toBe(false);
        // Database should still be intact
    });

    test('should prevent SQL injection in search', async () => {
        const token = 'valid_jwt_token'; // Get from login
        const maliciousSearch = "'; DROP TABLE projects; --";

        const response = await request(app)
            .get(`/api/projects?search=${maliciousSearch}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });
});
```

---

## 8. Deployment Configuration

### 8.1 Docker Configuration

#### Dockerfile for Backend
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Start application
CMD ["npm", "start"]
```

#### Dockerfile for Frontend
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  database:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: multitenant_saas
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DB_HOST: database
      DB_PORT: 5432
      DB_NAME: multitenant_saas
      DB_USER: postgres
      DB_PASSWORD: password
      JWT_SECRET: your-secret-key-change-in-production
    ports:
      - "5000:5000"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:5000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      REACT_APP_API_URL: http://localhost:5000/api
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - app-network

volumes:
  postgres_data:
    driver: local

networks:
  app-network:
    driver: bridge
```

### 8.2 Environment Configuration

#### Environment Variables
```bash
# .env.production
NODE_ENV=production

# Database Configuration
DB_HOST=database
DB_PORT=5432
DB_NAME=multitenant_saas
DB_USER=postgres
DB_PASSWORD=your-secure-password

# JWT Configuration
JWT_SECRET=your-very-secure-secret-key
JWT_EXPIRES_IN=1h

# Application Configuration
PORT=5000
API_URL=http://localhost:5000/api

# Security
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Health Check
HEALTH_CHECK_TIMEOUT=5000
```

### 8.3 Production Considerations

#### Performance Optimizations
```javascript
// config/production.js
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

app.use('/api', limiter);
```

---

## 9. Monitoring & Maintenance

### 9.1 Health Monitoring

#### Health Check Implementation
```javascript
// healthcheck.js
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    timeout: 5000
};

const request = http.request(options, (response) => {
    if (response.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', () => {
    process.exit(1);
});

request.on('timeout', () => {
    request.destroy();
    process.exit(1);
});

request.end();
```

#### Comprehensive Health Endpoint
```javascript
// controllers/healthController.js
const { checkDbConnection } = require('../config/database');
const os = require('os');

const getHealthStatus = async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Database connectivity check
        const dbStatus = await checkDbConnection();
        
        // Memory usage
        const memoryUsage = process.memoryUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        
        // Uptime
        const uptime = process.uptime();
        
        // Response time
        const responseTime = Date.now() - startTime;
        
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbStatus.status,
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
                total: Math.round(totalMemory / 1024 / 1024) + 'MB',
                free: Math.round(freeMemory / 1024 / 1024) + 'MB'
            },
            uptime: Math.floor(uptime) + 's',
            responseTime: responseTime + 'ms',
            version: process.env.npm_package_version || '1.0.0'
        };
        
        if (dbStatus.status === 'disconnected') {
            return res.status(503).json({
                ...healthData,
                status: 'error',
                error: dbStatus.error
            });
        }
        
        res.status(200).json(healthData);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
};

module.exports = { getHealthStatus };
```

### 9.2 Logging Strategy

#### Structured Logging
```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { 
        service: 'multitenant-saas',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
});

// Log request middleware
const logRequest = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: duration + 'ms',
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id,
            tenantId: req.user?.tenant_id
        });
    });
    
    next();
};

module.exports = { logger, logRequest };
```

---

## 10. Performance Optimization

### 10.1 Database Query Optimization

#### Efficient Query Patterns
```javascript
// models/optimizedQueries.js

// Optimized user listing with pagination
const getUsersPaginated = async (tenantId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    
    const query = `
        SELECT 
            id, email, full_name, role, is_active, created_at,
            COUNT(*) OVER() as total_count
        FROM users 
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `;
    
    return await pool.query(query, [tenantId, limit, offset]);
};

// Optimized project listing with task counts
const getProjectsWithTaskCounts = async (tenantId) => {
    const query = `
        SELECT 
            p.id, p.name, p.description, p.created_at,
            u.full_name as created_by_name,
            COUNT(t.id) as total_tasks,
            COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
        FROM projects p
        JOIN users u ON p.created_by = u.id
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.tenant_id = $1 AND p.is_active = true
        GROUP BY p.id, u.full_name
        ORDER BY p.created_at DESC
    `;
    
    return await pool.query(query, [tenantId]);
};

// Optimized task listing with joins
const getTasksWithDetails = async (tenantId, filters = {}) => {
    let whereConditions = ['t.tenant_id = $1'];
    let queryParams = [tenantId];
    let paramIndex = 2;
    
    if (filters.project_id) {
        whereConditions.push(`t.project_id = $${paramIndex}`);
        queryParams.push(filters.project_id);
        paramIndex++;
    }
    
    if (filters.status) {
        whereConditions.push(`t.status = $${paramIndex}`);
        queryParams.push(filters.status);
        paramIndex++;
    }
    
    if (filters.assigned_to) {
        whereConditions.push(`t.assigned_to = $${paramIndex}`);
        queryParams.push(filters.assigned_to);
        paramIndex++;
    }
    
    const query = `
        SELECT 
            t.id, t.title, t.description, t.priority, t.status, t.due_date,
            p.name as project_name,
            u1.full_name as assigned_to_name,
            u2.full_name as created_by_name,
            t.created_at
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        JOIN users u2 ON t.created_by = u2.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
            CASE t.priority 
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            t.created_at DESC
    `;
    
    return await pool.query(query, queryParams);
};
```

### 10.2 Frontend Performance

#### Code Splitting and Lazy Loading
```javascript
// App.js with lazy loading
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loading from './components/Loading';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const Projects = lazy(() => import('./pages/Projects'));
const Tasks = lazy(() => import('./pages/Tasks'));

function App() {
    return (
        <AuthProvider>
            <Router>
                <Suspense fallback={<Loading />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/users" element={
                            <ProtectedRoute requiredRole="tenant_admin">
                                <Users />
                            </ProtectedRoute>
                        } />
                        <Route path="/projects" element={
                            <ProtectedRoute>
                                <Projects />
                            </ProtectedRoute>
                        } />
                        <Route path="/tasks" element={
                            <ProtectedRoute>
                                <Tasks />
                            </ProtectedRoute>
                        } />
                    </Routes>
                </Suspense>
            </Router>
        </AuthProvider>
    );
}

export default App;
```

#### Memoization and Performance Optimization
```javascript
// components/OptimizedUserList.js
import React, { memo, useMemo, useCallback } from 'react';

const UserRow = memo(({ user, onEdit, onDelete }) => {
    const handleEdit = useCallback(() => onEdit(user), [user, onEdit]);
    const handleDelete = useCallback(() => onDelete(user.id, user.email), [user.id, user.email, onDelete]);
    
    return (
        <tr>
            <td>{user.full_name}</td>
            <td>{user.email}</td>
            <td>{user.role}</td>
            <td>
                <button onClick={handleEdit}>Edit</button>
                <button onClick={handleDelete}>Delete</button>
            </td>
        </tr>
    );
});

const UserList = memo(({ users, onEditUser, onDeleteUser }) => {
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }, [users]);
    
    return (
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {sortedUsers.map(user => (
                    <UserRow 
                        key={user.id}
                        user={user}
                        onEdit={onEditUser}
                        onDelete={onDeleteUser}
                    />
                ))}
            </tbody>
        </table>
    );
});

export default UserList;
```

---

**Document Approval:**
- Technical Lead: [Signature Required]
- Backend Developer: [Signature Required]
- Frontend Developer: [Signature Required]
- QA Engineer: [Signature Required]
- DevOps Engineer: [Signature Required]
