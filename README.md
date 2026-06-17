# 🎓 School Management System

A production-ready, full-stack School Management System built entirely on **free-tier cloud services**.
Manages students, teachers, attendance, grades, fees, library, transport, assignments, messaging, and analytics.

[![CI](https://github.com/your-org/school-management/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/school-management/actions/workflows/ci.yml)
[![Deploy](https://github.com/your-org/school-management/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/school-management/actions/workflows/deploy.yml)

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Deployment Guide](#deployment-guide)
- [API Documentation](#api-documentation)
- [Demo Credentials](#demo-credentials)
- [Known Limitations](#known-limitations)

---

## 🏗️ Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full Architecture Decision Record.

```
Frontend (Next.js → Vercel)
      ↕ REST API
Backend (Express → Render)
      ↕              ↕              ↕
PostgreSQL (Neon)  Redis (Upstash)  Files (Cloudinary)
```

---

## 🛠️ Tech Stack

| Layer        | Technology                     | Hosting          | Cost     |
|--------------|--------------------------------|------------------|----------|
| Frontend     | Next.js 14, TailwindCSS, TypeScript | Vercel         | Free     |
| Backend      | Node.js, Express, TypeScript   | Render           | Free     |
| Database     | PostgreSQL + Prisma ORM        | Neon             | Free     |
| Cache        | Redis                          | Upstash          | Free     |
| Files        | Cloudinary                     | Cloudinary       | Free     |
| Email        | SendGrid                       | SendGrid         | Free     |
| SMS          | Twilio                         | Twilio (trial)   | ~Free    |
| Payments     | Stripe                         | Stripe Test Mode | Free     |
| CI/CD        | GitHub Actions                 | GitHub           | Free     |

---

## ✅ Prerequisites

Ensure you have the following installed:

- **Node.js** 20+ — [nodejs.org](https://nodejs.org)
- **npm** 10+ (comes with Node.js)
- **Docker** + **Docker Compose** — [docker.com](https://docker.com) *(for local dev)*
- **Git** — [git-scm.com](https://git-scm.com)

---

## 🚀 Quick Start (Local)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/school-management.git
cd school-management
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables section)
```

At minimum, set these for local development (Docker will handle the rest):
```bash
JWT_ACCESS_SECRET=any-32-char-secret-here-dev-ok-1
JWT_REFRESH_SECRET=different-32-char-secret-here-2
```

### 3. Start with Docker Compose

```bash
# Start all services (Postgres, Redis, Backend, Frontend, Nginx)
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Stop
docker compose -f docker/docker-compose.yml down
```

### 4. Run database migrations and seed

```bash
# Apply migrations
docker compose -f docker/docker-compose.yml exec backend npx prisma migrate dev

# Seed with demo data
docker compose -f docker/docker-compose.yml exec backend npm run db:seed
```

### 5. Access the application

| Service       | URL                          |
|---------------|------------------------------|
| Frontend      | http://localhost:3000        |
| Backend API   | http://localhost:5000/api/v1 |
| API Health    | http://localhost:5000/health |
| Via Nginx     | http://localhost:80          |
| pgAdmin       | http://localhost:5050 *(optional)* |

---

## 🔧 Manual Setup (Without Docker)

### Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (ensure DATABASE_URL is set in .env)
npx prisma migrate dev

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env`. The critical variables are:

```env
# Required for local dev
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...      # min 32 chars
JWT_REFRESH_SECRET=...     # min 32 chars, different from above

# Optional (system works without these in dev with stubs)
UPSTASH_REDIS_REST_URL=...
STRIPE_SECRET_KEY=sk_test_...
EMAIL_PASS=...             # SendGrid API key
CLOUDINARY_API_SECRET=...
```

See `.env.example` for the full list with comments.

---

## 🧪 Running Tests

### Unit Tests

```bash
cd backend
npm run test:unit
```

Tests: grade calculation, attendance aggregation, fee calculations.

### Integration Tests

```bash
cd backend

# Ensure a test database is running
npm run test:integration
```

Tests: auth flow (login/logout/refresh), student CRUD with RBAC, 404 handling.

### E2E Tests (Playwright)

```bash
cd backend

# Requires both backend and frontend running
npm run dev &          # backend
cd ../frontend && npm run dev &  # frontend

# Run E2E suite
npm run test:e2e
```

Tests: login as all 4 roles, navigation, role-based access control, form submission.

### All Tests + Coverage

```bash
cd backend
npm run test:coverage
```

---

## 🚢 Deployment Guide

### Step 1: Set up free-tier accounts

Sign up for these free services:

| Service    | Sign-up URL                         | Purpose         |
|------------|-------------------------------------|-----------------|
| Vercel     | https://vercel.com/signup           | Frontend host   |
| Render     | https://render.com/register         | Backend host    |
| Neon       | https://neon.tech                   | PostgreSQL DB   |
| Upstash    | https://upstash.com                 | Redis cache     |
| Cloudinary | https://cloudinary.com/users/register | File storage  |
| SendGrid   | https://signup.sendgrid.com         | Email service   |

### Step 2: Deploy the database (Neon)

1. Create a new project at [neon.tech](https://neon.tech)
2. Copy your **Connection String** → set as `DATABASE_URL` in secrets
3. Copy the **direct connection URL** → set as `DIRECT_URL`
4. Run migrations: `npx prisma migrate deploy`

### Step 3: Deploy the backend (Render)

1. Connect your GitHub repo to [Render](https://render.com)
2. Create a **New Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && node dist/index.js`
   - **Instance Type**: Free
3. Add environment variables from your `.env` in Render's dashboard
4. Copy your Render service URL

### Step 4: Deploy the frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# From the frontend directory
cd frontend
vercel

# Follow prompts, then set environment variables:
vercel env add NEXT_PUBLIC_API_URL
# Enter: https://your-backend.onrender.com/api/v1
```

Or via the Vercel dashboard:
1. Import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api/v1`

### Step 5: Configure GitHub Actions

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

```
VERCEL_TOKEN         → From vercel.com/account/tokens
VERCEL_ORG_ID        → From .vercel/project.json after `vercel link`
VERCEL_PROJECT_ID    → From .vercel/project.json
RENDER_DEPLOY_HOOK   → From Render dashboard → Settings → Deploy Hook
DATABASE_URL         → Your Neon production connection string
DIRECT_URL           → Your Neon direct connection string
JWT_ACCESS_SECRET    → Your production JWT secret
JWT_REFRESH_SECRET   → Your production JWT refresh secret
```

In **Settings → Variables → Actions**, add:
```
BACKEND_URL          → https://your-app.onrender.com
FRONTEND_URL         → https://your-app.vercel.app
```

### Step 6: Seed production database

```bash
DATABASE_URL="your-neon-url" npx prisma db seed
```

---

## 📡 API Documentation

Base URL: `http://localhost:5000/api/v1`

### Authentication

All protected endpoints require: `Authorization: Bearer <accessToken>`

| Method | Endpoint                   | Description                    | Auth    |
|--------|----------------------------|--------------------------------|---------|
| POST   | `/auth/register`           | Create new account             | Public  |
| POST   | `/auth/login`              | Login, returns tokens          | Public  |
| POST   | `/auth/refresh`            | Refresh access token           | Cookie  |
| POST   | `/auth/logout`             | Revoke tokens                  | Bearer  |
| GET    | `/auth/me`                 | Get current user profile       | Bearer  |
| POST   | `/auth/forgot-password`    | Send password reset email      | Public  |
| POST   | `/auth/reset-password`     | Reset with token               | Public  |
| GET    | `/auth/verify-email`       | Verify email address           | Public  |
| POST   | `/auth/mfa/setup`          | Get MFA QR code                | Bearer  |
| POST   | `/auth/mfa/verify`         | Enable MFA with TOTP code      | Bearer  |

### Core Resources

| Resource              | Endpoints                       | Admin | Teacher | Student | Parent |
|-----------------------|---------------------------------|-------|---------|---------|--------|
| `/students`           | GET, POST, PUT, DELETE          | ✅    | R       | R(own)  | R(child)|
| `/teachers`           | GET, POST, PUT, DELETE          | ✅    | R       | ❌      | ❌     |
| `/classes`            | GET, POST, PUT                  | ✅    | R       | R       | R      |
| `/subjects`           | GET, POST, PUT                  | ✅    | R       | R       | ❌     |
| `/attendance`         | GET, POST                       | ✅    | ✅      | R(own)  | R(child)|
| `/timetable`          | GET, POST (slot), DELETE (slot) | ✅    | R       | R       | R      |
| `/exams`              | GET, POST, PUT                  | ✅    | ✅      | R       | R      |
| `/grades`             | GET, POST, PUT                  | ✅    | ✅      | R(own)  | R(child)|
| `/fees`               | GET, POST                       | ✅    | ❌      | R(own)  | R(child)|
| `/fees/checkout`      | POST                            | ✅    | ❌      | ✅      | ✅     |
| `/library/books`      | GET, POST                       | ✅    | ✅      | R       | ❌     |
| `/library/issue`      | POST                            | ✅    | ✅      | ❌      | ❌     |
| `/transport/routes`   | GET, POST                       | ✅    | R       | R       | R      |
| `/assignments`        | GET, POST                       | ✅    | ✅      | R       | ❌     |
| `/assignments/:id/submit` | POST                        | ❌    | ❌      | ✅      | ❌     |
| `/announcements`      | GET, POST, PUT, DELETE          | ✅    | ✅      | R       | R      |
| `/messages/inbox`     | GET                             | ✅    | ✅      | ✅      | ✅     |
| `/messages`           | POST                            | ✅    | ✅      | ✅      | ✅     |
| `/notifications`      | GET, PATCH                      | ✅    | ✅      | ✅      | ✅     |
| `/reports/dashboard`  | GET                             | ✅    | ❌      | ❌      | ❌     |
| `/reports/financial`  | GET                             | ✅    | ❌      | ❌      | ❌     |

### Pagination

All list endpoints support:
```
?page=1&limit=20&search=keyword
```

Response format:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 👤 Demo Credentials

| Role    | Email                                    | Password      |
|---------|------------------------------------------|---------------|
| Admin   | admin@school.edu                         | Admin@123     |
| Teacher | john.smith@school.edu                   | Teacher@123   |
| Student | alice.johnson@student.school.edu         | Student@123   |
| Parent  | parent@school.edu                        | Parent@123    |

---

## ⚠️ Known Limitations (Free Tier)

| Limitation                    | Detail                                                      | Mitigation                          |
|-------------------------------|-------------------------------------------------------------|-------------------------------------|
| Render cold starts            | Free tier spins down after 15 min; first request ~30s      | Upgrade to $7/mo Starter plan       |
| Neon 10 connections           | Prisma connection pool capped at 5                          | Use Prisma Accelerate if needed     |
| Upstash 10K commands/day      | ~3K used at steady state for a 500-student school           | Reduce polling intervals            |
| SendGrid 100 emails/day       | Batching digests mitigates this                             | Upgrade to Essentials $20/mo        |
| No WebSockets (real-time)     | Notifications require page refresh or polling               | Add Pusher/Ably free tier           |
| No background job queue       | Heavy jobs (report exports) run in-request                  | Add BullMQ with paid Redis          |
| File uploads 25 GB Cloudinary | More than sufficient for MVP                                | Upgrade if needed                   |
| No CDN for API                | Render free tier has no CDN                                 | Add Cloudflare proxy (free)         |
| PDF export                    | Report card PDF export is stubbed (returns JSON)            | Add Puppeteer with paid server      |

---

## 📁 Project Structure

```
school-management/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis, app config
│   │   ├── middleware/       # Auth, RBAC, error handling
│   │   ├── modules/         # Feature modules (auth, students, etc.)
│   │   │   ├── auth/
│   │   │   ├── students/
│   │   │   ├── teachers/
│   │   │   ├── attendance/
│   │   │   ├── grades/
│   │   │   ├── fees/
│   │   │   └── ... (14 modules total)
│   │   └── utils/           # Logger, email, JWT helpers
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema (all 30+ models)
│   │   └── seed.ts          # Demo data seeder
│   ├── tests/
│   │   ├── unit/            # Business logic tests
│   │   ├── integration/     # API endpoint tests
│   │   └── e2e/             # Playwright browser tests
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── auth/            # Login, register, password reset
│   │   └── dashboard/
│   │       ├── admin/       # Admin portal (students, reports, fees…)
│   │       ├── teacher/     # Teacher portal (attendance, grades…)
│   │       ├── student/     # Student portal (assignments, grades…)
│   │       └── parent/      # Parent portal (fees, progress…)
│   ├── components/
│   │   ├── layout/          # Sidebar, Header, DashboardLayout
│   │   ├── ui/              # shadcn/ui components
│   │   └── charts/          # Recharts wrappers
│   └── lib/
│       ├── api.ts           # Axios client + all API functions
│       ├── auth-store.ts    # Zustand auth state
│       └── utils.ts         # formatters, helpers
├── docs/
│   └── ARCHITECTURE.md      # Full ADR
├── docker/
│   ├── docker-compose.yml
│   └── nginx.conf
├── .github/workflows/
│   ├── ci.yml               # Lint + test on PRs
│   └── deploy.yml           # Deploy on merge to main
└── .env.example
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request — CI will run automatically

---

## 📄 License

MIT — See [LICENSE](LICENSE) file for details.
