# Architecture Decision Record (ADR)
# School Management System

> **Status**: Accepted | **Date**: 2025-01-01 | **Total Monthly Cost**: $0

---

## 1. System Overview

A full-stack, multi-tenant School Management System designed to run entirely on free-tier cloud
services. It handles students, teachers, parents, classes, attendance, grading, fees, library,
transport, assignments, messaging, and analytics.

---

## 2. Technology Choices & Justification

### 2.1 Frontend — Next.js 14 + TypeScript + TailwindCSS → Vercel

| Reason | Detail |
|--------|--------|
| **Free hosting** | Vercel hobby plan: 100 GB bandwidth, unlimited deployments |
| **SSR/SSG hybrid** | Server components for auth-gated pages; static for landing |
| **App Router** | Nested layouts enable role-based dashboard shells cleanly |
| **TypeScript** | End-to-end type safety with shared types |
| **TailwindCSS** | No runtime CSS-in-JS cost; purged for tiny bundles |
| **shadcn/ui** | Copy-paste components, no npm bundle overhead |

**Free-tier compliance**: Vercel hobby plan gives 100 GB/month bandwidth. With aggressive
static generation and ISR, a school of 2,000 users stays well under limit.

### 2.2 Backend — Node.js + Express + TypeScript → Render

| Reason | Detail |
|--------|--------|
| **Render free tier** | 750 hours/month free web service (spins down after 15 min idle) |
| **Express** | Lighter than NestJS — smaller memory footprint for free 512 MB RAM |
| **TypeScript** | Shared type contracts with frontend |
| **Zod** | Runtime validation matching TypeScript types |
| **Prisma ORM** | Type-safe queries; migration system; works perfectly with Neon |

**Free-tier compliance**: Render free tier has 512 MB RAM. Express + Node.js idles at ~80 MB.
Prisma connection pooling keeps DB connections under Neon's 10-connection free limit.

### 2.3 Database — PostgreSQL via Neon → Free Tier

| Reason | Detail |
|--------|--------|
| **Neon** | 512 MB storage, 10 GB transfer/month, serverless branching |
| **Serverless driver** | @neondatabase/serverless handles cold starts gracefully |
| **PostgreSQL** | Full ACID compliance for financial/grade data integrity |
| **Connection pooling** | Prisma Data Proxy / PgBouncer keeps connections ≤ 10 |

**Alternative**: Supabase (500 MB, more features but slower cold starts).

### 2.4 Cache & Sessions — Redis via Upstash

| Reason | Detail |
|--------|--------|
| **Upstash free** | 10,000 commands/day — sufficient for sessions + rate limiting |
| **HTTP-based Redis** | Works in serverless without persistent connections |
| **Use cases** | JWT refresh token blacklist, rate limiting, timetable cache |

### 2.5 Authentication — JWT + bcrypt + RBAC

- **Access tokens**: 15-minute expiry, stored in memory (JavaScript variable)
- **Refresh tokens**: 7-day expiry, stored in httpOnly cookie (XSS-proof)
- **Roles**: `admin`, `teacher`, `student`, `parent`
- **bcrypt rounds**: 12 (secure, ~200ms on free tier — acceptable)
- **MFA stub**: TOTP via `otplib` (secret generation + verification endpoint ready)

### 2.6 File Storage — Cloudinary Free Tier

| Reason | Detail |
|--------|--------|
| **Free quota** | 25 GB storage, 25 GB bandwidth/month |
| **Use cases** | Profile photos, assignment uploads, course materials |
| **Auto-optimization** | Automatic image compression, format conversion |

### 2.7 Email — SendGrid Free Tier

- 100 emails/day free forever
- Used for: registration confirmation, password reset, grade reports, fee reminders
- Batching: daily digests instead of per-event emails to stay within limit

### 2.8 SMS — Twilio Trial

- Trial credits for SMS notifications
- Used only for critical alerts (exam results, fee overdue)
- Fallback: email if credits exhausted

### 2.9 Payments — Stripe Test Mode

- Full Stripe API in test mode (no charges to cards)
- Fee management, invoice generation, payment tracking
- Switch to live keys with zero code changes when school is ready

### 2.10 CI/CD — GitHub Actions

- Free for public repos; 2,000 minutes/month for private
- Runs: lint → test → build → deploy
- Deploy: Vercel CLI (frontend) + Render deploy hook (backend)

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET / CDN                               │
│                    (Cloudflare Free - DNS, DDoS)                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
┌─────────────────┐              ┌─────────────────────┐
│   FRONTEND      │              │     BACKEND API      │
│  Next.js 14     │◄────REST────►│  Express + TypeScript│
│  Vercel (Free)  │              │  Render.com (Free)   │
│                 │              │                      │
│ /auth           │              │ /api/v1/auth         │
│ /dashboard/     │              │ /api/v1/users        │
│   admin         │              │ /api/v1/students     │
│   teacher       │              │ /api/v1/attendance   │
│   student       │              │ /api/v1/grades       │
│   parent        │              │ /api/v1/fees         │
└─────────────────┘              │ ... (14 modules)     │
                                 └──────────┬──────────┘
                                            │
               ┌────────────────────────────┼──────────────────────┐
               │                            │                       │
               ▼                            ▼                       ▼
    ┌──────────────────┐       ┌──────────────────┐    ┌──────────────────┐
    │   PostgreSQL     │       │   Redis Cache    │    │   Cloudinary     │
    │   Neon (Free)    │       │ Upstash (Free)   │    │ File Storage     │
    │ 512 MB / 10 conn │       │ 10K cmds/day     │    │ 25 GB free       │
    └──────────────────┘       └──────────────────┘    └──────────────────┘
               │
    ┌──────────┴──────────┐
    │   External Services │
    │  SendGrid (Email)   │
    │  Twilio (SMS)       │
    │  Stripe (Payments)  │
    │  Firebase (Push)    │
    └─────────────────────┘
```

---

## 4. Authentication Flow

```
┌──────────┐                    ┌─────────┐               ┌──────────┐
│  Client  │                    │  API    │               │   DB     │
└────┬─────┘                    └────┬────┘               └────┬─────┘
     │                               │                          │
     │  POST /auth/login             │                          │
     │  {email, password}            │                          │
     │──────────────────────────────►│                          │
     │                               │  SELECT user WHERE email │
     │                               │─────────────────────────►│
     │                               │◄─────────────────────────│
     │                               │  bcrypt.compare(pw, hash)│
     │                               │                          │
     │  200 OK                       │                          │
     │  {accessToken: JWT 15min}     │                          │
     │  Set-Cookie: refreshToken     │                          │
     │  (httpOnly, 7days, SameSite)  │                          │
     │◄──────────────────────────────│                          │
     │                               │                          │
     │  GET /api/v1/students         │                          │
     │  Authorization: Bearer <JWT>  │                          │
     │──────────────────────────────►│                          │
     │                               │  verifyJWT(token)        │
     │                               │  checkRole('admin|teacher')
     │                               │─────────────────────────►│
     │  200 OK {data}                │◄─────────────────────────│
     │◄──────────────────────────────│                          │
     │                               │                          │
     │  POST /auth/refresh           │                          │
     │  Cookie: refreshToken         │                          │
     │──────────────────────────────►│                          │
     │                               │  Redis: token valid?     │
     │                               │  Issue new accessToken   │
     │  200 OK {new accessToken}     │                          │
     │◄──────────────────────────────│                          │
```

---

## 5. RBAC Permission Matrix

| Resource               | admin | teacher | student | parent |
|------------------------|-------|---------|---------|--------|
| User CRUD              | ✅    | ❌      | ❌      | ❌     |
| Student profiles       | ✅    | R       | R(own)  | R(child)|
| Class management       | ✅    | R       | R       | R      |
| Attendance CRUD        | ✅    | ✅      | R(own)  | R(child)|
| Grade entry            | ✅    | ✅      | R(own)  | R(child)|
| Fee management         | ✅    | ❌      | R(own)  | R(child)|
| Library management     | ✅    | ✅      | R       | ❌      |
| Assignment create      | ✅    | ✅      | R       | ❌      |
| Assignment submit      | ❌    | ❌      | ✅      | ❌      |
| Reports                | ✅    | limited | ❌      | limited|
| System configuration   | ✅    | ❌      | ❌      | ❌     |
| Announcements          | ✅    | ✅(class)| R      | R      |
| Messaging              | ✅    | ✅      | ✅      | ✅     |

---

## 6. Data Flow & Caching Strategy

```
Request → Rate Limiter → Auth Middleware → RBAC Guard → Controller
                                                              │
                                              ┌──────────────┴───────────────┐
                                              │                              │
                                        Cache hit?                     Cache miss
                                         Redis                           Prisma
                                           │                              │
                                        Return                        DB Query
                                        cached                           │
                                           │                        Store in Redis
                                           └──────────────┬───────────────┘
                                                          │
                                                     Response
```

**Cached resources** (TTL):
- Timetable: 1 hour (rarely changes)
- Class list: 30 minutes
- Subject catalog: 1 hour
- User profile: 5 minutes
- Dashboard stats: 15 minutes

---

## 7. Free-Tier Compliance Checklist

| Service         | Limit              | Our Usage          | Status |
|-----------------|--------------------|--------------------|--------|
| Vercel          | 100 GB bandwidth   | ~2 GB/month (2K users) | ✅  |
| Render          | 750 hrs/month      | Always-on (720 hrs)| ✅     |
| Neon            | 512 MB storage     | ~100 MB for 2K users| ✅    |
| Neon            | 10 connections     | Prisma pool: 5 max | ✅     |
| Upstash         | 10K cmds/day       | ~3K cmd/day avg    | ✅     |
| Cloudinary      | 25 GB storage      | ~5 GB for assets   | ✅     |
| SendGrid        | 100 emails/day     | Digest batching    | ✅     |
| GitHub Actions  | 2K min/month       | ~500 min/month     | ✅     |
| Stripe          | Test mode: free    | Free indefinitely  | ✅     |

---

## 8. Scaling Path (when free limits are exceeded)

1. **Database**: Upgrade Neon to $19/month for 10 GB storage
2. **Backend**: Render starter plan $7/month (no spin-down)
3. **Cache**: Upstash Pro $10/month for 1M commands/day
4. **Email**: SendGrid Essentials $19.95/month for 50K emails/day
5. **Horizontal scale**: Add second Render service for read-heavy operations

---

## 9. Security Considerations

- All secrets via environment variables (never hardcoded)
- HTTP-only cookies for refresh tokens (XSS protection)
- CSRF protection via SameSite=Strict cookie attribute
- Rate limiting: 100 req/15min per IP (Upstash Redis)
- Input validation: Zod schemas on every endpoint
- SQL injection: prevented by Prisma parameterized queries
- Password hashing: bcrypt with cost factor 12
- Sensitive data: AES-256-GCM encryption for SSN/ID numbers
- HTTPS enforced via Render/Vercel (automatic TLS)
- CORS: whitelist only frontend domain
- Helmet.js for security headers
