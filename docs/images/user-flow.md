# User Flow Diagram
```
┌─────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION FLOW             │
└─────────────────────────────────────────────────────────┘

   ┌──────────┐    ┌──────────────┐    ┌─────────────────┐
   │  Login   │    │   Validate   │    │   Generate      │
   │  Page    │───▶│ Credentials  │───▶│   JWT Token     │
   └──────────┘    └──────────────┘    └─────────────────┘
        │                   │                    │
        ▼                   ▼                    ▼
   Invalid Creds       User Found          Token Created
        │                   │                    │
        ▼                   │                    ▼
   ┌──────────┐            │            ┌─────────────────┐
   │   Show   │            │            │   Redirect to   │
   │  Error   │            │            │   Dashboard     │
   └──────────┘            │            └─────────────────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │   Check User    │
                    │     Role        │
                    └─────────────────┘
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
        ┌─────────────┐ ┌─────────┐ ┌─────────────┐
        │ Super Admin │ │ Tenant  │ │    User     │
        │  Dashboard  │ │  Admin  │ │ Dashboard   │
        │             │ │Dashboard│ │             │
        │• All Tenant │ │         │ │• View Tasks │
        │  Management │ │• User   │ │• View       │
        │• System     │ │  Mgmt   │ │  Projects   │
        │  Monitoring │ │• Project│ │• Update     │
        │             │ │  Mgmt   │ │  Profile    │
        └─────────────┘ └─────────┘ └─────────────┘

┌─────────────────────────────────────────────────────────┐
│                    USER MANAGEMENT FLOW                 │
└─────────────────────────────────────────────────────────┘

    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Tenant Admin │    │   Add User   │    │   Validate   │
    │ Clicks "Add  │───▶│    Modal     │───▶│    Input     │
    │   User"      │    │              │    │              │
    └──────────────┘    └──────────────┘    └──────────────┘
                                │                    │
                                ▼                    ▼
                        ┌──────────────┐    ┌──────────────┐
                        │ Show Form    │    │  Validation  │
                        │ Fields:      │    │    Errors    │
                        │• Email       │◄───┤              │
                        │• Name        │    │              │
                        │• Role        │    │              │
                        │• Password    │    │              │
                        └──────────────┘    └──────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │   Save to    │
                        │  Database    │
                        └──────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │   Update     │
                        │  User List   │
                        └──────────────┘

┌─────────────────────────────────────────────────────────┐
│                PROJECT & TASK MANAGEMENT FLOW           │
└─────────────────────────────────────────────────────────┘

    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │   Create     │    │   Project    │    │   Add Tasks  │
    │   Project    │───▶│   Created    │───▶│ to Project   │
    └──────────────┘    └──────────────┘    └──────────────┘
           │                     │                    │
           ▼                     ▼                    ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Project Form │    │ Show Project │    │  Task Form   │
    │• Name        │    │ in List      │    │• Title       │
    │• Description │    │              │    │• Priority    │
    └──────────────┘    └──────────────┘    │• Assign User │
                                            │• Due Date    │
                                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │  Task List   │
                                            │  Updated     │
                                            └──────────────┘
```

This diagram should be saved as `user-flow.png` in the docs/images/ folder.
