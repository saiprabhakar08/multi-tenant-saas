# API Documentation
## Multi-Tenant SaaS Project Management System

### API Information
- **Version**: 1.0
- **Base URL**: `http://localhost:5000/api`
- **Content-Type**: `application/json`
- **Authentication**: JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Project Management](#project-management)
4. [Task Management](#task-management)
5. [System Health](#system-health)
6. [Error Handling](#error-handling)
7. [Request/Response Examples](#request-response-examples)

---

## Authentication

### Login User

**Endpoint**: `POST /auth/login`

**Description**: Authenticates a user and returns a JWT token.

**Request Body**:
```json
{
    "email": "string (required)",
    "password": "string (required)"
}
```

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "token": "jwt_token_string",
        "user": {
            "id": "uuid",
            "email": "string",
            "full_name": "string",
            "role": "super_admin|tenant_admin|user",
            "tenant_id": "uuid|null"
        },
        "expires_in": 3600
    }
}
```

**Error Response** (401):
```json
{
    "success": false,
    "error": "Invalid email or password",
    "code": "INVALID_CREDENTIALS"
}
```

### Get Current User

**Endpoint**: `GET /auth/me`

**Description**: Returns the current authenticated user's information.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "email": "string",
        "full_name": "string",
        "role": "super_admin|tenant_admin|user",
        "tenant_id": "uuid|null",
        "is_active": true,
        "last_login": "2025-12-26T09:00:00Z"
    }
}
```

---

## User Management

### List Tenant Users

**Endpoint**: `GET /tenants/:tenantId/users`

**Description**: Retrieves all users for a specific tenant.

**Authorization**: Tenant Admin or Super Admin only

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `tenantId` (required): UUID of the tenant

**Success Response** (200):
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "email": "string",
            "full_name": "string",
            "role": "tenant_admin|user",
            "is_active": boolean,
            "created_at": "ISO_8601_datetime",
            "updated_at": "ISO_8601_datetime"
        }
    ]
}
```

### Create User

**Endpoint**: `POST /users`

**Description**: Creates a new user in the system.

**Authorization**: Tenant Admin or Super Admin only

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
    "email": "string (required, valid email)",
    "password": "string (required, min 8 chars)",
    "full_name": "string (required)",
    "role": "tenant_admin|user (required)",
    "is_active": "boolean (optional, default: true)"
}
```

**Success Response** (201):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "email": "string",
        "full_name": "string",
        "role": "tenant_admin|user",
        "tenant_id": "uuid",
        "is_active": boolean,
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

**Error Response** (400):
```json
{
    "success": false,
    "error": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
        "email": ["Valid email address is required"],
        "password": ["Password must be at least 8 characters"]
    }
}
```

### Update User

**Endpoint**: `PUT /users/:userId`

**Description**: Updates an existing user.

**Authorization**: Tenant Admin, Super Admin, or the user themselves

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters**:
- `userId` (required): UUID of the user

**Request Body**:
```json
{
    "email": "string (optional)",
    "full_name": "string (optional)",
    "role": "tenant_admin|user (optional)",
    "is_active": "boolean (optional)"
}
```

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "email": "string",
        "full_name": "string",
        "role": "tenant_admin|user",
        "tenant_id": "uuid",
        "is_active": boolean,
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

### Delete User

**Endpoint**: `DELETE /users/:userId`

**Description**: Deletes a user from the system.

**Authorization**: Tenant Admin or Super Admin only

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `userId` (required): UUID of the user

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "message": "User deleted successfully"
    }
}
```

**Error Response** (403):
```json
{
    "success": false,
    "error": "Cannot delete your own account",
    "code": "CANNOT_DELETE_SELF"
}
```

---

## Project Management

### List Projects

**Endpoint**: `GET /projects`

**Description**: Retrieves all projects for the authenticated user's tenant.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Query Parameters** (optional):
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20, max: 100)
- `search`: Search term to filter projects by name
- `created_by`: Filter by creator's user ID
- `is_active`: Filter by active status (true/false)

**Success Response** (200):
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "name": "string",
            "description": "string",
            "created_by": "uuid",
            "created_by_name": "string",
            "is_active": boolean,
            "created_at": "ISO_8601_datetime",
            "updated_at": "ISO_8601_datetime",
            "task_count": integer,
            "completed_task_count": integer
        }
    ],
    "meta": {
        "total": integer,
        "page": integer,
        "limit": integer,
        "pages": integer
    }
}
```

### Create Project

**Endpoint**: `POST /projects`

**Description**: Creates a new project.

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
    "name": "string (required, max 255 chars)",
    "description": "string (optional, max 2000 chars)"
}
```

**Success Response** (201):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "created_by": "uuid",
        "tenant_id": "uuid",
        "is_active": true,
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

### Get Project Details

**Endpoint**: `GET /projects/:projectId`

**Description**: Retrieves detailed information about a specific project.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `projectId` (required): UUID of the project

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "created_by": "uuid",
        "created_by_name": "string",
        "tenant_id": "uuid",
        "is_active": boolean,
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime",
        "tasks": [
            {
                "id": "uuid",
                "title": "string",
                "status": "pending|in_progress|completed|cancelled",
                "priority": "low|medium|high|urgent",
                "assigned_to_name": "string",
                "due_date": "ISO_8601_date"
            }
        ]
    }
}
```

### Update Project

**Endpoint**: `PUT /projects/:projectId`

**Description**: Updates an existing project.

**Authorization**: Project creator, Tenant Admin, or Super Admin

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters**:
- `projectId` (required): UUID of the project

**Request Body**:
```json
{
    "name": "string (optional)",
    "description": "string (optional)",
    "is_active": "boolean (optional)"
}
```

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "created_by": "uuid",
        "tenant_id": "uuid",
        "is_active": boolean,
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

### Delete Project

**Endpoint**: `DELETE /projects/:projectId`

**Description**: Deletes a project and all associated tasks.

**Authorization**: Project creator, Tenant Admin, or Super Admin

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `projectId` (required): UUID of the project

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "message": "Project and all associated tasks deleted successfully"
    }
}
```

---

## Task Management

### List Tasks

**Endpoint**: `GET /tasks`

**Description**: Retrieves tasks with filtering options.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Query Parameters** (optional):
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20, max: 100)
- `project_id`: Filter by project UUID
- `assigned_to`: Filter by assigned user UUID
- `created_by`: Filter by creator user UUID
- `status`: Filter by status (pending|in_progress|completed|cancelled)
- `priority`: Filter by priority (low|medium|high|urgent)
- `due_date_from`: Filter tasks due from this date (YYYY-MM-DD)
- `due_date_to`: Filter tasks due until this date (YYYY-MM-DD)
- `search`: Search term for task title or description

**Success Response** (200):
```json
{
    "success": true,
    "data": [
        {
            "id": "uuid",
            "title": "string",
            "description": "string",
            "priority": "low|medium|high|urgent",
            "status": "pending|in_progress|completed|cancelled",
            "project_id": "uuid",
            "project_name": "string",
            "assigned_to": "uuid",
            "assigned_to_name": "string",
            "created_by": "uuid",
            "created_by_name": "string",
            "due_date": "ISO_8601_date",
            "completed_at": "ISO_8601_datetime",
            "created_at": "ISO_8601_datetime",
            "updated_at": "ISO_8601_datetime"
        }
    ],
    "meta": {
        "total": integer,
        "page": integer,
        "limit": integer,
        "pages": integer,
        "filters_applied": object
    }
}
```

### Create Task

**Endpoint**: `POST /tasks`

**Description**: Creates a new task.

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
    "title": "string (required, max 255 chars)",
    "description": "string (optional, max 2000 chars)",
    "project_id": "uuid (required)",
    "priority": "low|medium|high|urgent (optional, default: medium)",
    "assigned_to": "uuid (optional)",
    "due_date": "YYYY-MM-DD (optional)"
}
```

**Success Response** (201):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "project_id": "uuid",
        "tenant_id": "uuid",
        "priority": "low|medium|high|urgent",
        "status": "pending",
        "assigned_to": "uuid",
        "created_by": "uuid",
        "due_date": "ISO_8601_date",
        "completed_at": null,
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

### Get Task Details

**Endpoint**: `GET /tasks/:taskId`

**Description**: Retrieves detailed information about a specific task.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `taskId` (required): UUID of the task

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "priority": "low|medium|high|urgent",
        "status": "pending|in_progress|completed|cancelled",
        "project_id": "uuid",
        "project_name": "string",
        "tenant_id": "uuid",
        "assigned_to": "uuid",
        "assigned_to_name": "string",
        "created_by": "uuid",
        "created_by_name": "string",
        "due_date": "ISO_8601_date",
        "completed_at": "ISO_8601_datetime",
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

### Update Task

**Endpoint**: `PUT /tasks/:taskId`

**Description**: Updates an existing task.

**Authorization**: Task creator, assignee, Tenant Admin, or Super Admin

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters**:
- `taskId` (required): UUID of the task

**Request Body**:
```json
{
    "title": "string (optional)",
    "description": "string (optional)",
    "priority": "low|medium|high|urgent (optional)",
    "status": "pending|in_progress|completed|cancelled (optional)",
    "assigned_to": "uuid (optional)",
    "due_date": "YYYY-MM-DD (optional)"
}
```

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "priority": "low|medium|high|urgent",
        "status": "pending|in_progress|completed|cancelled",
        "project_id": "uuid",
        "tenant_id": "uuid",
        "assigned_to": "uuid",
        "created_by": "uuid",
        "due_date": "ISO_8601_date",
        "completed_at": "ISO_8601_datetime",
        "created_at": "ISO_8601_datetime",
        "updated_at": "ISO_8601_datetime"
    }
}
```

### Delete Task

**Endpoint**: `DELETE /tasks/:taskId`

**Description**: Deletes a task.

**Authorization**: Task creator, Tenant Admin, or Super Admin

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**URL Parameters**:
- `taskId` (required): UUID of the task

**Success Response** (200):
```json
{
    "success": true,
    "data": {
        "message": "Task deleted successfully"
    }
}
```

---

## System Health

### Health Check

**Endpoint**: `GET /health`

**Description**: Returns the current health status of the system.

**Authentication**: Not required

**Success Response** (200):
```json
{
    "status": "ok",
    "database": "connected",
    "timestamp": "ISO_8601_datetime",
    "uptime": 86400,
    "version": "1.0.0",
    "memory": {
        "used": "256MB",
        "total": "1024MB",
        "free": "768MB"
    }
}
```

**Error Response** (503):
```json
{
    "status": "error",
    "database": "disconnected",
    "error": "Connection timeout",
    "timestamp": "ISO_8601_datetime"
}
```

---

## Error Handling

### Standard Error Response Format

All API errors follow this consistent format:

```json
{
    "success": false,
    "error": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": "object (optional - for validation errors)",
    "meta": {
        "timestamp": "ISO_8601_datetime",
        "path": "string",
        "method": "string"
    }
}
```

### HTTP Status Codes

- **200 OK**: Successful GET, PUT, DELETE requests
- **201 Created**: Successful POST requests
- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Authentication required or invalid credentials
- **403 Forbidden**: Insufficient permissions for the requested action
- **404 Not Found**: Requested resource does not exist
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **422 Unprocessable Entity**: Validation failed
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: Service temporarily unavailable

### Common Error Codes

#### Authentication Errors
- `TOKEN_REQUIRED`: Authorization token is missing
- `INVALID_TOKEN`: Token is invalid or expired
- `USER_INACTIVE`: User account is deactivated
- `INVALID_CREDENTIALS`: Email or password is incorrect

#### Authorization Errors
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `TENANT_ACCESS_DENIED`: User cannot access tenant resources
- `CANNOT_DELETE_SELF`: User cannot delete their own account

#### Validation Errors
- `VALIDATION_ERROR`: Input validation failed
- `INVALID_UUID`: Provided ID is not a valid UUID
- `INVALID_EMAIL`: Email format is invalid
- `PASSWORD_TOO_WEAK`: Password doesn't meet complexity requirements

#### Resource Errors
- `USER_NOT_FOUND`: Requested user does not exist
- `PROJECT_NOT_FOUND`: Requested project does not exist
- `TASK_NOT_FOUND`: Requested task does not exist
- `DUPLICATE_EMAIL`: Email already exists in system

#### System Errors
- `DATABASE_ERROR`: Database connection or query failed
- `RATE_LIMIT_EXCEEDED`: Too many requests in time window
- `INTERNAL_ERROR`: Unexpected server error

---

## Request/Response Examples

### Example 1: User Registration Flow

**Step 1: Login as Admin**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "Demo@123"
  }'
```

Response:
```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "email": "admin@demo.com",
            "full_name": "Demo Admin",
            "role": "tenant_admin",
            "tenant_id": "987fcdeb-51a2-43d1-9f47-123456789abc"
        },
        "expires_in": 3600
    }
}
```

**Step 2: Create New User**
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "email": "newuser@demo.com",
    "password": "SecurePass123!",
    "full_name": "New User",
    "role": "user"
  }'
```

Response:
```json
{
    "success": true,
    "data": {
        "id": "456e7890-e89b-12d3-a456-426614174001",
        "email": "newuser@demo.com",
        "full_name": "New User",
        "role": "user",
        "tenant_id": "987fcdeb-51a2-43d1-9f47-123456789abc",
        "is_active": true,
        "created_at": "2025-12-26T10:00:00Z",
        "updated_at": "2025-12-26T10:00:00Z"
    }
}
```

### Example 2: Project and Task Creation

**Step 1: Create Project**
```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "Website Redesign",
    "description": "Complete overhaul of company website"
  }'
```

**Step 2: Create Task**
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "title": "Design Homepage Mockup",
    "description": "Create initial mockup for new homepage design",
    "project_id": "789e0123-e89b-12d3-a456-426614174002",
    "priority": "high",
    "assigned_to": "456e7890-e89b-12d3-a456-426614174001",
    "due_date": "2025-12-30"
  }'
```

### Example 3: Error Handling

**Invalid Request Example**
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "email": "invalid-email",
    "password": "123",
    "full_name": "",
    "role": "invalid_role"
  }'
```

Error Response:
```json
{
    "success": false,
    "error": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
        "email": ["Valid email address is required"],
        "password": ["Password must be at least 8 characters"],
        "full_name": ["Full name is required"],
        "role": ["Role must be one of: tenant_admin, user"]
    },
    "meta": {
        "timestamp": "2025-12-26T10:00:00Z",
        "path": "/api/users",
        "method": "POST"
    }
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Rate Limit**: 100 requests per 15-minute window per IP address
- **Headers**: Response includes rate limit headers:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Time when rate limit resets

**Rate Limit Exceeded Response** (429):
```json
{
    "success": false,
    "error": "Too many requests, please try again later",
    "code": "RATE_LIMIT_EXCEEDED",
    "meta": {
        "retry_after": 900,
        "timestamp": "2025-12-26T10:00:00Z"
    }
}
```

---

## API Versioning

The API uses URL path versioning:
- Current version: `/api/v1/`
- Future versions: `/api/v2/`, etc.

Version headers in responses:
```json
{
    "meta": {
        "api_version": "1.0",
        "timestamp": "2025-12-26T10:00:00Z"
    }
}
```

---

**For additional support or questions about this API, please refer to the technical documentation or contact the development team.**
