# Motion - AI Calendar & Task Manager
## Complete Project Setup & Development Guide

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack & Requirements](#tech-stack--requirements)
3. [Setup Instructions](#setup-instructions)
4. [Project Structure](#project-structure)
5. [Database Design (ERD)](#database-design-erd)
6. [API Blueprint](#api-blueprint)
7. [Frontend Components Blueprint](#frontend-components-blueprint)
8. [Development Roadmap](#development-roadmap)
9. [Key Milestones](#key-milestones)

---

## Project Overview

### What is Motion?
Motion is an **AI-powered calendar & task management system** that automatically schedules tasks into your calendar based on:
- Task duration & deadlines
- Calendar availability
- User priorities & preferences
- Focus time blocks
- Break times

### Core Features (MVP)
- ✅ User authentication (signup/login)
- ✅ Task management (CRUD operations)
- ✅ Calendar integration (Google Calendar, Outlook)
- ✅ AI task scheduling algorithm
- ✅ Calendar sync & real-time updates
- ✅ Basic analytics & productivity tracking
- ✅ User preferences (work hours, focus blocks)

### Revenue Model
- **Freemium**: Free for basic features (5 tasks/month)
- **Pro** ($19/month): Unlimited tasks, advanced scheduling
- **Team** ($49/month): Team collaboration, shared calendars

### Target Market
- Busy professionals
- Remote workers
- Freelancers
- Small teams
- Project managers

---

## Tech Stack & Requirements

### Backend (Golang)
```
Framework:        Echo or Gin
Database:         PostgreSQL
ORM:              GORM
Authentication:   JWT (jsonwebtoken)
Task Queue:       Redis
File Storage:     AWS S3 (optional for MVP)
Caching:          Redis
Testing:          testify, gotest
```

### Frontend (Next.js)
```
Framework:        Next.js 14+ (App Router)
UI Library:       React 18+
Styling:          TailwindCSS
State Management: Zustand
HTTP Client:      axios / fetch
Calendar UI:      react-big-calendar
Charts:           recharts
Form:             react-hook-form
Icons:            lucide-react
Testing:          Jest, React Testing Library
```

### DevOps & Tools
```
Version Control:  Git / GitHub
Containerization: Docker
Database:         PostgreSQL 15+
Task Queue:       Redis 7+
API Testing:      Postman / Insomnia
Environment:      .env files
```

### Prerequisites

Before starting, install:

1. **Golang 1.21+**
   ```bash
   # MacOS
   brew install go
   
   # Linux
   sudo apt install golang-go
   
   # Windows
   Download from https://golang.org/dl/
   ```
   Verify: `go version`

2. **Node.js 18+ & npm**
   ```bash
   # MacOS
   brew install node
   
   # Linux
   sudo apt install nodejs npm
   
   # Windows
   Download from https://nodejs.org/
   ```
   Verify: `node -v && npm -v`

3. **PostgreSQL 15+**
   ```bash
   # MacOS
   brew install postgresql
   
   # Linux
   sudo apt install postgresql postgresql-contrib
   
   # Windows
   Download from https://www.postgresql.org/download/
   ```
   Verify: `psql --version`

4. **Redis 7+**
   ```bash
   # MacOS
   brew install redis
   
   # Linux
   sudo apt install redis-server
   
   # Windows
   https://microsoftarchive.github.io/redis/
   ```
   Verify: `redis-cli --version`

5. **Git**
   ```bash
   # Install from https://git-scm.com/
   ```
   Verify: `git --version`

6. **Text Editor/IDE**
   - VSCode (recommended)
   - GoLand (for Golang)
   - WebStorm (for React)

7. **Docker (Optional)**
   ```bash
   # Download from https://www.docker.com/
   ```

8. **Postman or Insomnia (API Testing)**
   - Download from https://www.postman.com/ or https://insomnia.rest/

---

## Setup Instructions

### Step 1: Create Project Directories

```bash
# Create main project folder
mkdir motion-app && cd motion-app

# Create backend folder
mkdir motion-backend && cd motion-backend

# Create frontend folder
cd ..
mkdir motion-frontend
```

### Step 2: Backend Setup (Golang)

```bash
cd motion-backend

# Initialize Go module
go mod init github.com/yourusername/motion-backend

# Create basic structure
mkdir -p cmd config handlers models services middleware database pkg

# Create main.go file (see below for content)
touch main.go

# Install dependencies
go get github.com/labstack/echo/v4
go get github.com/labstack/echo/v4/middleware
go get gorm.io/gorm
go get gorm.io/driver/postgres
go get github.com/golang-jwt/jwt/v5
go get github.com/joho/godotenv
go get github.com/go-redis/redis/v8
go get github.com/google/uuid
go get github.com/stripe/stripe-go/v75
```

### Step 3: Frontend Setup (Next.js)

```bash
cd ../motion-frontend

# Create Next.js app
npx create-next-app@latest . --typescript --tailwind --app

# Install additional dependencies
npm install axios zustand react-big-calendar recharts react-hook-form
npm install -D tailwindcss postcss autoprefixer

# Create folder structure
mkdir -p components/{Calendar,Tasks,Analytics,Common}
mkdir -p lib hooks
mkdir -p styles types
mkdir -p public/images

# Install UI icons
npm install lucide-react
```

### Step 4: Database Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE motion_db;

# Create user with password
CREATE USER motion_user WITH PASSWORD 'your_secure_password';
ALTER ROLE motion_user WITH CREATEDB;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE motion_db TO motion_user;

# Exit psql
\q
```

### Step 5: Create .env Files

**Backend (.env)**
```
# Motion Backend Environment Variables

# Server
SERVER_PORT=8080
SERVER_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=motion_user
DB_PASSWORD=your_secure_password
DB_NAME=motion_db
DB_SSL_MODE=disable

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRATION=24h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# External APIs
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# AWS (optional for MVP)
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=
```

**Frontend (.env.local)**
```
# Motion Frontend Environment Variables

NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_APP_NAME=Motion
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### Step 6: Verify Setup

```bash
# Backend
cd motion-backend
go mod download
go build

# Frontend
cd ../motion-frontend
npm install

# Test run
npm run dev
```

---

## Project Structure

### Backend Directory Structure

```
motion-backend/
├── main.go                          # Entry point
├── .env                             # Environment variables
├── go.mod                           # Go module file
├── go.sum                           # Go dependencies lock
├── Dockerfile                       # Docker configuration
├── docker-compose.yml               # Docker compose
│
├── cmd/
│   └── server/
│       └── main.go                  # Server startup
│
├── config/
│   ├── config.go                    # Load environment & config
│   └── database.go                  # Database connection
│
├── models/
│   ├── user.go                      # User model
│   ├── task.go                      # Task model
│   ├── calendar_event.go            # Calendar event model
│   ├── scheduling_preference.go     # User preferences
│   ├── calendar_connection.go       # Calendar sync
│   └── analytics.go                 # Analytics model
│
├── handlers/
│   ├── auth.go                      # Auth handlers (login, signup)
│   ├── tasks.go                     # Task CRUD handlers
│   ├── calendar.go                  # Calendar handlers
│   ├── scheduling.go                # Scheduling algorithm handlers
│   ├── preferences.go               # User preferences handlers
│   ├── analytics.go                 # Analytics handlers
│   └── health.go                    # Health check
│
├── services/
│   ├── auth_service.go              # Auth business logic
│   ├── task_service.go              # Task business logic
│   ├── scheduling_engine.go         # AI scheduling algorithm
│   ├── calendar_sync_service.go     # Calendar sync logic
│   ├── notification_service.go      # Email/notification logic
│   └── analytics_service.go         # Analytics calculations
│
├── middleware/
│   ├── auth.go                      # JWT authentication
│   ├── cors.go                      # CORS handling
│   ├── error_handler.go             # Error handling
│   └── request_logger.go            # Request logging
│
├── database/
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_tasks.sql
│   │   ├── 003_create_calendar_events.sql
│   │   ├── 004_create_preferences.sql
│   │   └── 005_create_analytics.sql
│   └── seeder.go                    # Database seeders
│
├── pkg/
│   ├── utils/
│   │   ├── jwt.go                   # JWT utilities
│   │   ├── hashing.go               # Password hashing
│   │   └── response.go              # Response formatting
│   └── errors/
│       └── errors.go                # Custom errors
│
└── tests/
    ├── handlers_test.go
    ├── services_test.go
    └── fixtures/
        └── test_data.go
```

### Frontend Directory Structure

```
motion-frontend/
├── package.json
├── package-lock.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── .env.local
├── .gitignore
│
├── app/
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Home page (landing)
│   ├── globals.css                  # Global styles
│   │
│   ├── auth/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx           # Login page
│   │   ├── signup/page.tsx          # Signup page
│   │   └── onboarding/page.tsx      # Onboarding flow
│   │
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Main calendar view
│   │   ├── tasks/page.tsx           # Tasks list view
│   │   ├── analytics/page.tsx       # Analytics dashboard
│   │   └── settings/
│   │       ├── page.tsx             # Settings main
│   │       ├── preferences.tsx      # Work hours, focus time
│   │       └── integrations.tsx     # Calendar connections
│   │
│   └── api/
│       ├── auth/[...nextauth].ts    # NextAuth config (optional)
│       └── health/route.ts          # Health check endpoint
│
├── components/
│   ├── Calendar/
│   │   ├── CalendarView.tsx         # Main calendar component
│   │   ├── TaskBlock.tsx            # Individual task block
│   │   ├── DayView.tsx              # Day view
│   │   ├── WeekView.tsx             # Week view
│   │   └── MonthView.tsx            # Month view
│   │
│   ├── Tasks/
│   │   ├── TaskList.tsx             # Tasks list
│   │   ├── TaskCard.tsx             # Individual task card
│   │   ├── TaskForm.tsx             # Create/edit task form
│   │   ├── QuickAddTask.tsx         # Quick add floating button
│   │   └── TaskFilter.tsx           # Filter tasks
│   │
│   ├── Analytics/
│   │   ├── ProductivityDashboard.tsx
│   │   ├── ProductivityChart.tsx    # Line chart
│   │   ├── TimeBreakdown.tsx        # Pie chart
│   │   ├── CompletionRate.tsx       # Completion statistics
│   │   └── InsightCard.tsx          # Individual insight
│   │
│   ├── Common/
│   │   ├── Navigation.tsx           # Top navigation bar
│   │   ├── Sidebar.tsx              # Left sidebar
│   │   ├── Header.tsx               # Page header
│   │   ├── Loading.tsx              # Loading spinner
│   │   ├── Modal.tsx                # Modal component
│   │   └── Toast.tsx                # Notification toast
│   │
│   └── Forms/
│       ├── LoginForm.tsx
│       ├── SignupForm.tsx
│       └── PreferencesForm.tsx
│
├── lib/
│   ├── api.ts                       # API client setup
│   ├── auth.ts                      # Auth utilities
│   ├── storage.ts                   # Local storage utilities
│   └── utils.ts                     # General utilities
│
├── hooks/
│   ├── useAuth.ts                   # Auth hook
│   ├── useTasks.ts                  # Tasks hook
│   ├── useCalendar.ts               # Calendar hook
│   └── useAnalytics.ts              # Analytics hook
│
├── types/
│   ├── index.ts                     # TypeScript types
│   ├── api.ts                       # API response types
│   └── models.ts                    # Data model types
│
├── styles/
│   ├── globals.css
│   └── variables.css                # CSS variables
│
├── public/
│   ├── images/
│   ├── icons/
│   └── favicon.ico
│
└── tests/
    ├── components/
    ├── hooks/
    └── utils/
```

---

## Database Design (ERD)

### Entity Relationship Diagram (Conceptual)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
├──────────────────────┬──────────────────────────────────────────┤
│ id (PK, UUID)        │ Primary Key                              │
│ email (UNIQUE)       │ User email                               │
│ password_hash        │ Hashed password                          │
│ name                 │ User full name                           │
│ timezone             │ User timezone (e.g., UTC, EST)          │
│ plan                 │ free/pro/team                           │
│ created_at           │ Account creation timestamp              │
│ updated_at           │ Last update timestamp                   │
└──────────────────────┴──────────────────────────────────────────┘
                              │ 1
                              │ (Has many)
                    ┌─────────┴─────────┐
                    │                   │
                    │ N                 │ N
        ┌───────────┴────────────┐  ┌──┴───────────────┐
        │                        │  │                  │
┌───────▼──────────────────┐  ┌─┴──▼───────────────┐  │
│      TASKS               │  │ CALENDAR_EVENTS    │  │
├──────────────────────────┤  ├────────────────────┤  │
│ id (PK, UUID)            │  │ id (PK, UUID)      │  │
│ user_id (FK)             │  │ user_id (FK)       │  │
│ title                    │  │ event_id           │  │
│ description              │  │ title              │  │
│ time_estimate_minutes    │  │ start_time         │  │
│ due_date                 │  │ end_time           │  │
│ priority (1-5)           │  │ source (google/    │  │
│ status                   │  │         outlook)   │  │
│ scheduled_start          │  │ is_busy            │  │
│ scheduled_end            │  │ created_at         │  │
│ completed_at             │  │ synced_at          │  │
│ category                 │  └────────────────────┘  │
│ recurring_rule           │                          │
│ created_at               │                          │
│ updated_at               │                          │
└──────────────────────────┘                          │
                                                       │
            ┌──────────────────────────────────────────┘
            │ N
            │ (Links to)
        ┌───┴─────────────────────────┐
        │                             │
        │ 1                           │ 1
┌───────▼──────────────────────┐  ┌──┴──────────────────────┐
│ SCHEDULING_PREFERENCES       │  │ CALENDAR_CONNECTIONS    │
├──────────────────────────────┤  ├────────────────────────┤
│ id (PK, UUID)                │  │ id (PK, UUID)          │
│ user_id (FK)                 │  │ user_id (FK)           │
│ work_hours_start (9am)       │  │ calendar_type          │
│ work_hours_end (6pm)         │  │ access_token           │
│ focus_time_blocks (JSONB)    │  │ refresh_token          │
│ break_duration_minutes       │  │ calendar_id            │
│ min_task_block_minutes       │  │ synced_at              │
│ allow_overload               │  │ created_at             │
│ created_at                   │  └────────────────────────┘
│ updated_at                   │
└──────────────────────────────┘

            │ 1
            │ (Tracks)
            │
        ┌───▼─────────────────┐
        │  ANALYTICS_LOGS     │
        ├─────────────────────┤
        │ id (PK, UUID)       │
        │ user_id (FK)        │
        │ date                │
        │ completed_tasks     │
        │ on_time_tasks       │
        │ late_tasks          │
        │ focus_hours         │
        │ meeting_hours       │
        │ created_at          │
        └─────────────────────┘
```

### SQL Schema

```sql
-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  plan VARCHAR(20) DEFAULT 'free', -- free, pro, team
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_estimate_minutes INTEGER DEFAULT 30,
  due_date TIMESTAMP,
  priority INTEGER DEFAULT 3, -- 1=lowest, 5=highest
  status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  completed_at TIMESTAMP,
  category VARCHAR(100), -- work, personal, health, education, etc
  recurring_rule VARCHAR(255), -- RRULE format: FREQ=WEEKLY;BYDAY=MO,WE,FR
  is_recurring BOOLEAN DEFAULT FALSE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- For recurring task instances
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_due_date (due_date),
  INDEX idx_status (status),
  INDEX idx_priority (priority)
);

-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_event_id VARCHAR(255), -- Google/Outlook event ID
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  calendar_source VARCHAR(50) NOT NULL, -- google, outlook, apple
  is_busy BOOLEAN DEFAULT TRUE,
  is_focus_block BOOLEAN DEFAULT FALSE,
  organizer VARCHAR(255),
  attendees JSONB, -- Array of attendee emails
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_start_time (start_time),
  INDEX idx_end_time (end_time)
);

-- ============================================
-- SCHEDULING PREFERENCES TABLE
-- ============================================
CREATE TABLE scheduling_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  work_hours_start INTEGER DEFAULT 9, -- 0-23 (9am)
  work_hours_end INTEGER DEFAULT 18, -- 0-23 (6pm)
  work_days VARCHAR(20) DEFAULT 'MON,TUE,WED,THU,FRI',
  focus_time_blocks JSONB DEFAULT '[]', -- [{start: 9, end: 11}, {start: 14, end: 16}]
  break_duration_minutes INTEGER DEFAULT 15,
  min_task_block_minutes INTEGER DEFAULT 30,
  allow_overload BOOLEAN DEFAULT FALSE,
  allow_evening_scheduling BOOLEAN DEFAULT FALSE,
  allow_weekend_scheduling BOOLEAN DEFAULT FALSE,
  preferred_task_time VARCHAR(50) DEFAULT 'morning', -- morning, afternoon, evening
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CALENDAR CONNECTIONS TABLE
-- ============================================
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_type VARCHAR(50) NOT NULL, -- google, outlook, apple
  calendar_id VARCHAR(255), -- Calendar ID from provider
  calendar_name VARCHAR(255),
  access_token VARCHAR(1024) NOT NULL, -- Encrypted
  refresh_token VARCHAR(1024), -- Encrypted (nullable for some providers)
  token_expires_at TIMESTAMP,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMP,
  sync_error_message VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  UNIQUE(user_id, calendar_type)
);

-- ============================================
-- TASK ASSIGNMENTS TABLE (for team feature)
-- ============================================
CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task_id (task_id),
  INDEX idx_assigned_to (assigned_to_user_id)
);

-- ============================================
-- ANALYTICS LOGS TABLE
-- ============================================
CREATE TABLE analytics_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  on_time_tasks INTEGER DEFAULT 0,
  late_tasks INTEGER DEFAULT 0,
  cancelled_tasks INTEGER DEFAULT 0,
  focus_hours DECIMAL(5,2) DEFAULT 0,
  meeting_hours DECIMAL(5,2) DEFAULT 0,
  break_hours DECIMAL(5,2) DEFAULT 0,
  productive_time_percentage DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_date (date),
  UNIQUE(user_id, date)
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- task_due, task_scheduled, meeting_reminder, etc
  title VARCHAR(255) NOT NULL,
  message TEXT,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read)
);

-- ============================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL, -- free, pro, team
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, cancelled, past_due
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Blueprint

### Authentication Endpoints

```
POST /api/v1/auth/register
├── Request:
│   {
│     "email": "user@example.com",
│     "password": "securepass123",
│     "name": "John Doe"
│   }
├── Response (201):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "email": "user@example.com",
│       "name": "John Doe",
│       "token": "jwt_token_here"
│     }
│   }
└── Error (400/409):
    {
      "success": false,
      "error": "Email already registered"
    }

POST /api/v1/auth/login
├── Request:
│   {
│     "email": "user@example.com",
│     "password": "securepass123"
│   }
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "email": "user@example.com",
│       "token": "jwt_token_here",
│       "expiresIn": 86400
│     }
│   }
└── Error (401):
    {
      "success": false,
      "error": "Invalid credentials"
    }

POST /api/v1/auth/refresh
├── Request: (Use refresh token in HTTP-only cookie)
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "token": "new_jwt_token"
│     }
│   }
└── Error (401): Unauthorized

POST /api/v1/auth/logout
├── Response (200):
│   {
│     "success": true,
│     "message": "Logged out successfully"
│   }
└── Note: Clear HTTP-only cookies

GET /api/v1/auth/me
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "email": "user@example.com",
│       "name": "John Doe",
│       "timezone": "UTC",
│       "plan": "pro"
│     }
│   }
└── Error (401): Unauthorized
```

### Task Endpoints

```
POST /api/v1/tasks
├── Headers: Authorization: Bearer {token}
├── Request:
│   {
│     "title": "Write blog post",
│     "description": "SEO blog about Golang",
│     "time_estimate_minutes": 120,
│     "due_date": "2024-06-15T17:00:00Z",
│     "priority": 4,
│     "category": "work",
│     "recurring_rule": null
│   }
├── Response (201):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "title": "Write blog post",
│       "status": "pending",
│       "scheduled_start": "2024-06-14T09:00:00Z",
│       "scheduled_end": "2024-06-14T11:00:00Z",
│       "created_at": "timestamp"
│     }
│   }
└── Note: AI auto-schedules task

GET /api/v1/tasks
├── Headers: Authorization: Bearer {token}
├── Query Params:
│   ?status=pending
│   &priority=4
│   &start_date=2024-06-01
│   &end_date=2024-06-30
│   &category=work
├── Response (200):
│   {
│     "success": true,
│     "data": [
│       {
│         "id": "uuid",
│         "title": "Write blog post",
│         "status": "pending",
│         "priority": 4,
│         "due_date": "timestamp",
│         "scheduled_start": "timestamp",
│         "scheduled_end": "timestamp"
│       }
│     ],
│     "pagination": {
│       "total": 25,
│       "page": 1,
│       "page_size": 10
│     }
│   }
└── Error (401): Unauthorized

GET /api/v1/tasks/:id
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "title": "Write blog post",
│       "description": "SEO blog about Golang",
│       "status": "pending",
│       "priority": 4,
│       "time_estimate_minutes": 120,
│       "due_date": "timestamp",
│       "scheduled_start": "timestamp",
│       "scheduled_end": "timestamp",
│       "category": "work",
│       "created_at": "timestamp",
│       "updated_at": "timestamp"
│     }
│   }
└── Error (404): Task not found

PATCH /api/v1/tasks/:id
├── Headers: Authorization: Bearer {token}
├── Request: (any field to update)
│   {
│     "title": "Updated title",
│     "priority": 5,
│     "status": "in_progress"
│   }
├── Response (200): Updated task object
└── Error (404/401)

PATCH /api/v1/tasks/:id/complete
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "status": "completed",
│       "completed_at": "timestamp"
│     }
│   }
└── Error (404/401)

DELETE /api/v1/tasks/:id
├── Headers: Authorization: Bearer {token}
├── Response (204): No content
└── Error (404/401)

PATCH /api/v1/tasks/:id/reschedule
├── Headers: Authorization: Bearer {token}
├── Request:
│   {
│     "scheduled_start": "2024-06-15T09:00:00Z",
│     "scheduled_end": "2024-06-15T11:00:00Z"
│   }
├── Response (200): Updated task
└── Note: Manual reschedule (override AI)
```

### Calendar Endpoints

```
POST /api/v1/calendar/connect
├── Headers: Authorization: Bearer {token}
├── Request:
│   {
│     "calendar_type": "google", // or "outlook"
│     "auth_code": "code_from_oauth_provider"
│   }
├── Response (201):
│   {
│     "success": true,
│     "data": {
│       "id": "uuid",
│       "calendar_type": "google",
│       "is_primary": true,
│       "synced_at": "timestamp"
│     }
│   }
└── Error (400): Invalid auth code

GET /api/v1/calendar/events
├── Headers: Authorization: Bearer {token}
├── Query Params:
│   ?start_date=2024-06-01T00:00:00Z
│   &end_date=2024-06-30T23:59:59Z
├── Response (200):
│   {
│     "success": true,
│     "data": [
│       {
│         "id": "uuid",
│         "title": "Team Meeting",
│         "start_time": "timestamp",
│         "end_time": "timestamp",
│         "is_busy": true
│       }
│     ]
│   }
└── Error (401)

POST /api/v1/calendar/sync
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "message": "Calendar synced successfully",
│     "synced_events": 15
│   }
└── Note: Manual sync (auto-sync happens in background)

GET /api/v1/calendar/connections
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": [
│       {
│         "id": "uuid",
│         "calendar_type": "google",
│         "is_primary": true,
│         "last_synced_at": "timestamp"
│       }
│     ]
│   }
└── Error (401)
```

### Scheduling Endpoints

```
POST /api/v1/scheduling/auto-schedule
├── Headers: Authorization: Bearer {token}
├── Request:
│   {
│     "task_id": "uuid"
│   }
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "task_id": "uuid",
│       "scheduled_start": "timestamp",
│       "scheduled_end": "timestamp",
│       "reason": "Scheduled during morning focus block on June 14"
│     }
│   }
└── Note: Re-run AI scheduling algorithm

GET /api/v1/scheduling/suggestions/:task_id
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": [
│       {
│         "start": "timestamp",
│         "end": "timestamp",
│         "score": 0.95,
│         "reason": "Matches focus time preference"
│       }
│     ]
│   }
└── Note: Return top 3 suggestions

GET /api/v1/scheduling/preferences
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "work_hours_start": 9,
│       "work_hours_end": 18,
│       "focus_time_blocks": [
│         {"start": 9, "end": 11},
│         {"start": 14, "end": 16}
│       ],
│       "break_duration_minutes": 15
│     }
│   }
└── Error (401)

PATCH /api/v1/scheduling/preferences
├── Headers: Authorization: Bearer {token}
├── Request: (any field to update)
│   {
│     "work_hours_start": 8,
│     "work_hours_end": 17,
│     "focus_time_blocks": [
│       {"start": 8, "end": 10},
│       {"start": 13, "end": 15}
│     ]
│   }
├── Response (200): Updated preferences
└── Error (401)
```

### Analytics Endpoints

```
GET /api/v1/analytics/dashboard
├── Headers: Authorization: Bearer {token}
├── Query Params:
│   ?period=week  // week, month, year, custom
│   &start_date=2024-06-01
│   &end_date=2024-06-30
├── Response (200):
│   {
│     "success": true,
│     "data": {
│       "summary": {
│         "total_tasks": 25,
│         "completed_tasks": 20,
│         "on_time_percentage": 85,
│         "productivity_score": 8.5
│       },
│       "daily_stats": [
│         {
│           "date": "2024-06-01",
│           "completed": 3,
│           "on_time": 3,
│           "focus_hours": 4.5
│         }
│       ],
│       "time_breakdown": {
│         "focus_time": 45,
│         "meeting_time": 20,
│         "break_time": 15,
│         "other": 20
│       }
│     }
│   }
└── Error (401)

GET /api/v1/analytics/insights
├── Headers: Authorization: Bearer {token}
├── Response (200):
│   {
│     "success": true,
│     "data": [
│       {
│         "type": "productivity",
│         "title": "Best Time to Focus",
│         "message": "You're 95% more productive between 9-11am",
│         "recommendation": "Schedule important tasks during morning hours"
│       },
│       {
│         "type": "calendar",
│         "title": "Meeting Heavy Days",
│         "message": "Wednesdays have 5+ meetings on average",
│         "recommendation": "Block focus time on other days"
│       }
│     ]
│   }
└── Note: AI-generated insights
```

---

## Frontend Components Blueprint

### Key Component Hierarchy

```
App
├── Layout
│   ├── Navigation (Header)
│   ├── Sidebar
│   ├── MainContent
│   │   ├── Dashboard Page
│   │   │   ├── CalendarView (Main)
│   │   │   │   ├── CalendarHeader (Day/Week/Month selector)
│   │   │   │   ├── CalendarGrid
│   │   │   │   │   ├── TimeSlots (left side)
│   │   │   │   │   ├── DayColumns
│   │   │   │   │   │   └── TaskBlocks (draggable)
│   │   │   │   │   └── MeetingBlocks (read-only)
│   │   │   │   └── RightSidebar
│   │   │   │       ├── TaskList (upcoming)
│   │   │   │       └── QuickAddTask
│   │   │   │
│   │   │   ├── TasksPage
│   │   │   │   ├── TaskFilter
│   │   │   │   ├── TaskList
│   │   │   │   │   └── TaskCard (clickable)
│   │   │   │   └── TaskDetailModal
│   │   │   │
│   │   │   ├── AnalyticsPage
│   │   │   │   ├── ProductivityScore
│   │   │   │   ├── ProductivityChart (line chart)
│   │   │   │   ├── TimeBreakdown (pie chart)
│   │   │   │   ├── CompletionStats
│   │   │   │   └── InsightCards
│   │   │   │
│   │   │   └── SettingsPage
│   │   │       ├── PreferencesForm (work hours, focus blocks)
│   │   │       ├── CalendarIntegrations
│   │   │       └── AccountSettings
│   │   │
│   │   └── Auth Pages
│   │       ├── LoginPage
│   │       ├── SignupPage
│   │       └── OnboardingFlow
│   └── Footer
└── Modals
    ├── TaskFormModal
    ├── TaskDetailModal
    └── ConfirmDialog
```

### Core Components to Build

#### 1. **CalendarView Component**
```typescript
// components/Calendar/CalendarView.tsx

interface CalendarViewProps {
  tasks: Task[];
  events: CalendarEvent[];
  viewMode: 'day' | 'week' | 'month';
  onTaskDrop?: (taskId: string, newStart: Date, newEnd: Date) => void;
  onTaskSelect?: (taskId: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  events,
  viewMode,
  onTaskDrop,
  onTaskSelect
}) => {
  // Render calendar with tasks and events
  // Support drag-drop for task rescheduling
  // Show focus blocks as colored areas
}
```

#### 2. **TaskForm Component**
```typescript
// components/Tasks/TaskForm.tsx

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: TaskInput) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  onSubmit,
  onCancel
}) => {
  // Form for creating/editing tasks
  // Fields: title, description, estimate, due date, priority, category
  // Submit triggers AI scheduling
}
```

#### 3. **ProductivityDashboard Component**
```typescript
// components/Analytics/ProductivityDashboard.tsx

interface ProductivityDashboardProps {
  period: 'week' | 'month' | 'year';
  data: AnalyticsData;
}

export const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({
  period,
  data
}) => {
  // Display productivity metrics
  // Charts, statistics, insights
}
```

---

## Development Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Goal: Setup & Basic CRUD**

- [ ] Backend Setup
  - [x] Initialize Go project
  - [x] Setup PostgreSQL database
  - [x] Create user & task models
  - [ ] Implement JWT authentication
  - [ ] Build auth endpoints (register, login)
  - [ ] Create CRUD endpoints for tasks
  - [ ] Basic error handling

- [ ] Frontend Setup
  - [x] Initialize Next.js project
  - [x] Setup TypeScript & TailwindCSS
  - [ ] Create login & signup pages
  - [ ] Build basic dashboard layout
  - [ ] Create task form & task list UI
  - [ ] Setup API client & authentication

- [ ] Testing
  - [ ] Unit tests for auth service
  - [ ] API endpoint tests

**Deliverable:** Working login + create/view tasks

---

### Phase 2: Calendar Integration (Weeks 3-4)
**Goal: Calendar Sync & Display**

- [ ] Backend
  - [ ] Google Calendar OAuth integration
  - [ ] Outlook OAuth integration
  - [ ] Calendar event sync service
  - [ ] Calendar endpoints (connect, get events, sync)
  - [ ] Database migration for calendar data

- [ ] Frontend
  - [ ] Calendar view component (week view)
  - [ ] Calendar connection settings
  - [ ] Display synced events in calendar
  - [ ] Show tasks in calendar

- [ ] Testing
  - [ ] Calendar sync tests
  - [ ] OAuth flow tests

**Deliverable:** View synced calendar + tasks in calendar view

---

### Phase 3: AI Scheduling Engine (Weeks 5-6)
**Goal: Core Algorithm**

- [ ] Backend
  - [ ] Implement scheduling algorithm
  - [ ] Find available time slots
  - [ ] Score & rank slots
  - [ ] Handle conflicts & rescheduling
  - [ ] Auto-schedule tasks on creation
  - [ ] Reschedule endpoint

- [ ] Frontend
  - [ ] Task scheduling suggestions UI
  - [ ] Drag-drop task rescheduling
  - [ ] Visual feedback for scheduling

- [ ] Testing
  - [ ] Algorithm unit tests
  - [ ] Scheduling scenarios testing

**Deliverable:** AI auto-schedules tasks intelligently

---

### Phase 4: Real-time & Notifications (Weeks 7-8)
**Goal: Live Updates**

- [ ] Backend
  - [ ] WebSocket setup
  - [ ] Real-time task updates
  - [ ] Email notifications
  - [ ] Push notifications
  - [ ] Background job queue (Redis)
  - [ ] Task reminder system

- [ ] Frontend
  - [ ] WebSocket client integration
  - [ ] Real-time calendar updates
  - [ ] Toast notifications
  - [ ] Toast component

- [ ] Testing
  - [ ] WebSocket tests
  - [ ] Notification delivery tests

**Deliverable:** Real-time updates + notifications

---

### Phase 5: Analytics & Insights (Weeks 9-10)
**Goal: Productivity Tracking**

- [ ] Backend
  - [ ] Analytics calculation service
  - [ ] Daily metrics aggregation
  - [ ] Productivity scoring algorithm
  - [ ] Insights generation (AI-based recommendations)
  - [ ] Analytics endpoints

- [ ] Frontend
  - [ ] Analytics dashboard
  - [ ] Charts & graphs (Recharts)
  - [ ] Metrics display
  - [ ] Insights cards

- [ ] Testing
  - [ ] Analytics calculation tests

**Deliverable:** Productivity analytics dashboard

---

### Phase 6: Polish & MVP Launch (Weeks 11-12)
**Goal: Production Ready**

- [ ] Backend
  - [ ] Error handling & logging
  - [ ] Input validation
  - [ ] API documentation
  - [ ] Rate limiting
  - [ ] Database optimization (indexes)
  - [ ] Security review (CORS, sanitization)
  - [ ] Deployment setup (Docker)

- [ ] Frontend
  - [ ] UI/UX polish
  - [ ] Error boundary & error states
  - [ ] Loading states
  - [ ] Empty states
  - [ ] Accessibility (a11y)
  - [ ] Mobile responsive testing
  - [ ] Build optimization

- [ ] Testing & QA
  - [ ] Full integration tests
  - [ ] User acceptance testing
  - [ ] Performance testing
  - [ ] Load testing

- [ ] Launch
  - [ ] Deploy backend
  - [ ] Deploy frontend
  - [ ] Setup monitoring & logging
  - [ ] Create documentation
  - [ ] Launch MVP

**Deliverable:** Production Motion MVP ready for users!

---

### Phase 7: Advanced Features (Post-MVP)
**Goal: Premium Features**

- [ ] Team Collaboration
  - [ ] Multi-user task assignment
  - [ ] Shared calendars
  - [ ] Team analytics
  - [ ] User roles & permissions

- [ ] Advanced Scheduling
  - [ ] Meeting scheduling (book time with others)
  - [ ] Buffer time between tasks
  - [ ] Smart meeting time finder
  - [ ] Calendar sharing with links

- [ ] Integrations
  - [ ] Slack integration
  - [ ] Asana / Jira integration
  - [ ] Email integration (parse emails to tasks)
  - [ ] Zapier integration

- [ ] Mobile App
  - [ ] React Native app (iOS & Android)
  - [ ] Native notifications
  - [ ] Offline support

---

## Key Milestones

### ✅ MVP Milestone (End of Week 12)

**Feature Complete:**
- User authentication (login/signup)
- Task creation & management
- Calendar integration (Google & Outlook)
- AI task scheduling
- Task rescheduling (drag-drop)
- Analytics dashboard
- User preferences (work hours, focus blocks)
- Notifications

**Metrics to Track:**
- User signup rate
- Task creation rate (tasks/user/day)
- Calendar sync success rate (%)
- Scheduling accuracy (on-time completion %)
- User retention (30-day, 60-day)

**Success Criteria:**
- 100+ beta users
- 80%+ of tasks scheduled on time
- 50%+ user retention (7-day)
- No critical bugs
- <2 second API response time

---

## Important Files to Create First

### Backend Files to Create

```bash
# Create these files in order:

# 1. Configuration
touch motion-backend/config/config.go
touch motion-backend/config/database.go

# 2. Models
touch motion-backend/models/user.go
touch motion-backend/models/task.go
touch motion-backend/models/calendar_event.go
touch motion-backend/models/scheduling_preference.go

# 3. Database
touch motion-backend/database/migrations/001_init.sql
touch motion-backend/database/seeder.go

# 4. Middleware
touch motion-backend/middleware/auth.go
touch motion-backend/middleware/cors.go

# 5. Services
touch motion-backend/services/auth_service.go
touch motion-backend/services/task_service.go
touch motion-backend/services/scheduling_engine.go

# 6. Handlers
touch motion-backend/handlers/auth.go
touch motion-backend/handlers/tasks.go
touch motion-backend/handlers/calendar.go

# 7. Utils
touch motion-backend/pkg/utils/jwt.go
touch motion-backend/pkg/utils/response.go
touch motion-backend/pkg/utils/errors.go

# 8. Main
touch motion-backend/main.go
```

### Frontend Files to Create

```bash
# Create these files in order:

# 1. Types
touch motion-frontend/types/index.ts
touch motion-frontend/types/models.ts

# 2. Lib
touch motion-frontend/lib/api.ts
touch motion-frontend/lib/auth.ts
touch motion-frontend/lib/utils.ts

# 3. Hooks
touch motion-frontend/hooks/useAuth.ts
touch motion-frontend/hooks/useTasks.ts
touch motion-frontend/hooks/useCalendar.ts

# 4. Components - Calendar
touch motion-frontend/components/Calendar/CalendarView.tsx
touch motion-frontend/components/Calendar/TaskBlock.tsx

# 5. Components - Tasks
touch motion-frontend/components/Tasks/TaskForm.tsx
touch motion-frontend/components/Tasks/TaskList.tsx

# 6. Components - Common
touch motion-frontend/components/Common/Navigation.tsx
touch motion-frontend/components/Common/Sidebar.tsx

# 7. Pages
touch motion-frontend/app/dashboard/page.tsx
touch motion-frontend/app/auth/login/page.tsx
touch motion-frontend/app/auth/signup/page.tsx
```

---

## Quick Reference Checklist

### Before Starting Development
- [ ] Go installed and verified
- [ ] Node.js 18+ installed and verified
- [ ] PostgreSQL running locally
- [ ] Redis running locally
- [ ] Git configured
- [ ] GitHub repo created
- [ ] .env files created (backend & frontend)
- [ ] Database created and migrations ready

### During Phase 1
- [ ] Backend compiles without errors
- [ ] Database migrations run successfully
- [ ] Auth endpoints tested in Postman
- [ ] Frontend pages load without errors
- [ ] API client working
- [ ] Login/signup flow working end-to-end

### Phase Completion Checklist
- [ ] All endpoints documented
- [ ] Tests written & passing
- [ ] Error handling implemented
- [ ] Logging setup
- [ ] Performance benchmarked
- [ ] Security review done
- [ ] Ready for next phase

---

## Git Workflow

```bash
# Initialize repo
git init
git remote add origin https://github.com/yourusername/motion-app.git

# Create branches for each phase
git checkout -b phase/1-foundation
git checkout -b phase/2-calendar
git checkout -b phase/3-scheduling
git checkout -b feature/auth
git checkout -b feature/tasks

# Commit frequently
git add .
git commit -m "feat: implement task scheduling algorithm"

# Push to GitHub
git push origin phase/1-foundation
```

---

## Resources & Documentation

### Golang Resources
- Echo Framework: https://echo.labstack.com/
- GORM: https://gorm.io/
- PostgreSQL: https://www.postgresql.org/docs/
- JWT: https://github.com/golang-jwt/jwt

### Next.js Resources
- Next.js Docs: https://nextjs.org/docs
- React: https://react.dev/
- TailwindCSS: https://tailwindcss.com/docs
- Zustand: https://github.com/pmndrs/zustand

### Learning Resources
- Golang by Example: https://gobyexample.com/
- React Patterns: https://patterns.dev/react/
- Database Design: https://sqlzoo.net/

---

## Contact & Support

For questions during development:
1. Check this blueprint first
2. Read official documentation
3. Google the error message
4. Ask in relevant Discord communities
5. Check GitHub issues

---

## Final Notes

✅ **This blueprint is your development roadmap**
- Follow the phases in order
- Complete each milestone before moving to the next
- Don't skip steps
- Test thoroughly before moving forward

✅ **Keep this file updated**
- Add notes as you progress
- Update timelines if needed
- Record lessons learned

✅ **Refer to ERD & API regularly**
- Database schema doesn't change
- API contract might evolve, but keep consistency
- Use as reference for naming conventions

---

**Good luck building Motion! 🚀**
