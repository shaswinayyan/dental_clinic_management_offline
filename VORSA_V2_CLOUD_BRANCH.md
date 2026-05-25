# Vorsa Cloud v2 — Branch Documentation

> **Branch:** `feature/v2-saas-cloud`
> **Remote:** `origin/feature/v2-saas-cloud`
> **GitHub:** https://github.com/shaswinayyan/dental_clinic_management_offline/tree/feature/v2-saas-cloud
> **Base branch:** `master`
> **Status:** Active development — 3 commits ahead of master, 116 files changed, +17,758 lines

---

## Table of Contents

1. [Overview](#1-overview)
2. [Why This Branch Exists](#2-why-this-branch-exists)
3. [Architecture Decision](#3-architecture-decision)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Tech Stack](#5-tech-stack)
6. [Backend (apps/api)](#6-backend-appsapi)
   - [Middleware Stack](#middleware-stack)
   - [API Routes Reference](#api-routes-reference)
   - [RBAC & Role Hierarchy](#rbac--role-hierarchy)
   - [Plan Enforcement](#plan-enforcement)
   - [Auth Flow (Clerk)](#auth-flow-clerk)
7. [Database (packages/db)](#7-database-packagesdb)
   - [Schema Overview](#schema-overview)
   - [All Tables](#all-tables)
8. [Shared Packages](#8-shared-packages)
9. [Frontend (apps/web)](#9-frontend-appsweb)
   - [Route Groups](#route-groups)
   - [All Pages](#all-pages)
   - [Design System](#design-system)
10. [Commit History](#10-commit-history)
11. [Environment Variables](#11-environment-variables)
12. [Getting Started](#12-getting-started)
13. [Comparison: v1 vs v2](#13-comparison-v1-vs-v2)
14. [Merging & Release Plan](#14-merging--release-plan)

---

## 1. Overview

`feature/v2-saas-cloud` is a **parallel implementation** of Vorsa as a full cloud SaaS product. It does **not** touch or replace the existing desktop Electron app (in `src/`). Both systems coexist in the same repository using the Strangler Fig pattern.

The v2 cloud system is a **multi-tenant, multi-branch dental clinic management platform** designed to:

- Run entirely in the cloud (no local installation required)
- Support multiple clinics as isolated tenants
- Allow each clinic to have multiple branches, multiple doctors, and branch-scoped staff
- Enforce monetisation tiers (Starter / Business / Enterprise) at the API level
- Be deployable on any serverless/edge-compatible infrastructure (Cloudflare Workers, Vercel, AWS Lambda)

---

## 2. Why This Branch Exists

The original `master` branch contains:
- Electron desktop app (offline, SQLite via `better-sqlite3`)
- Express.js server (local HTTP, raw pg queries)
- Ant Design + Vite renderer
- Custom JWT auth with `jsonwebtoken` + `bcryptjs`

This branch implements the **PRD v1.1 §12 tech stack update** which mandates a full cloud-native rewrite:

| Concern | v1 (master) | v2 (this branch) |
|---|---|---|
| Runtime | Electron + Express | Hono (edge-compatible HTTP) |
| Database | SQLite (better-sqlite3) | PostgreSQL via Neon (serverless) |
| ORM | None (raw pg queries) | Drizzle ORM |
| Auth | Custom JWT / bcrypt | Clerk (hosted, passwordless-ready) |
| Frontend | Vite + Ant Design | Next.js 15 App Router + shadcn/ui |
| CSS | Ant Design theme | Tailwind CSS v4 (`@theme`) |
| Monorepo | None | Turborepo + pnpm workspaces |
| Rate limiting | express-rate-limit | Upstash Redis (sliding window) |
| File storage | Local disk | Cloudflare R2 (prepared) |
| Background jobs | None | Trigger.dev (prepared) |
| Search | None | Typesense (prepared) |
| Realtime | None | Ably (prepared) |

---

## 3. Architecture Decision

The v2 system uses a **Strangler Fig pattern** — new cloud code is built alongside the old Electron code without touching it. When v2 is stable and released:

1. `apps/api` replaces `src/server`
2. `apps/web` replaces `src/renderer`
3. `packages/db` replaces raw pg/SQLite queries
4. The `src/` directory is removed and the Electron build scripts are cleaned up

This approach means:
- **No risk to the existing working desktop product** during v2 development
- Both can be tested independently
- Gradual migration of users from v1 to v2 SaaS

---

## 4. Monorepo Structure

```
dental/                          ← repo root
├── apps/
│   ├── api/                     ← Hono API server (Node.js)
│   │   ├── src/
│   │   │   ├── app.ts           ← Hono app factory + middleware chain
│   │   │   ├── env.ts           ← Typed env config
│   │   │   ├── index.ts         ← @hono/node-server entrypoint
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts      ← Clerk JWT verification
│   │   │   │   ├── rbac.ts      ← Role-based access control
│   │   │   │   ├── planGuard.ts ← Plan limit enforcement (402)
│   │   │   │   ├── rateLimiter.ts ← Upstash sliding window
│   │   │   │   └── errorHandler.ts ← Global error + 404 handler
│   │   │   ├── routers/
│   │   │   │   ├── index.ts     ← Mounts all routers at /api/v2/*
│   │   │   │   ├── auth.ts      ← /auth — register, /me, profile
│   │   │   │   ├── branches.ts  ← /branches — CRUD + config
│   │   │   │   ├── staff.ts     ← /staff — CRUD + invite flow
│   │   │   │   ├── patients.ts  ← /patients — CRUD + chart
│   │   │   │   ├── appointments.ts ← /appointments — CRUD + slots
│   │   │   │   ├── billing.ts   ← /billing — invoices + payments
│   │   │   │   ├── inventory.ts ← /inventory — items + transactions
│   │   │   │   ├── settings.ts  ← /settings — clinic + treatments + audit
│   │   │   │   ├── analytics.ts ← /analytics — Business+ gated reports
│   │   │   │   └── customisation.ts ← /customisation — notation/currency/etc.
│   │   │   └── services/
│   │   │       ├── tenant.ts    ← New clinic provisioning
│   │   │       ├── audit.ts     ← Audit log writer
│   │   │       └── opId.ts      ← Human-readable ID generator
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                     ← Next.js 15 App Router
│       ├── app/
│       │   ├── layout.tsx       ← Root layout (Providers wrapper)
│       │   ├── page.tsx         ← Redirects / → /dashboard
│       │   ├── globals.css      ← Tailwind v4 + @theme design tokens
│       │   ├── (auth)/          ← Public auth routes
│       │   │   ├── layout.tsx   ← Centred auth shell
│       │   │   ├── sign-in/[[...sign-in]]/page.tsx
│       │   │   └── sign-up/[[...sign-up]]/page.tsx
│       │   └── (app)/           ← Protected app routes
│       │       ├── layout.tsx   ← Sidebar + main content shell
│       │       ├── dashboard/page.tsx
│       │       ├── patients/page.tsx
│       │       ├── patients/[id]/page.tsx
│       │       ├── scheduler/page.tsx
│       │       ├── billing/page.tsx
│       │       ├── analytics/page.tsx
│       │       └── settings/page.tsx
│       ├── components/
│       │   ├── providers.tsx    ← ClerkProvider + QueryClientProvider
│       │   └── ui/sidebar.tsx   ← Persistent nav sidebar
│       ├── lib/
│       │   ├── api.ts           ← useApi() hook + apiFetch() server util
│       │   └── utils.ts         ← cn(), formatCurrency(), formatDate(), etc.
│       ├── middleware.ts        ← Clerk auth middleware (protects all app routes)
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── db/                      ← @vorsa/db — Drizzle ORM + Neon client
│   │   ├── src/
│   │   │   ├── client.ts        ← neon() + drizzle() setup, exports db
│   │   │   ├── index.ts         ← Re-exports all schema tables + helpers
│   │   │   └── schema/
│   │   │       ├── clinics.ts   ← clinics, clinicSettings, auditLogs
│   │   │       ├── branches.ts  ← branches, branchWorkingHours, apptConfig,
│   │   │       │                   apptCustomStatuses, chairs
│   │   │       ├── staff.ts     ← staff, staffInvites
│   │   │       ├── patients.ts  ← patients, allergies, medications,
│   │   │       │                   dentalChartEntries, clinicalAssessments
│   │   │       ├── appointments.ts ← treatments, appointments,
│   │   │       │                     treatmentRecords, customFields
│   │   │       ├── billing.ts   ← invoices, invoiceItems, payments
│   │   │       └── inventory.ts ← inventoryItems, inventoryTransactions
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── types/                   ← @vorsa/types — shared TypeScript types
│   │   └── src/index.ts         ← CloudRole, ClinicPlan, PLAN_LIMITS, all entities
│   │
│   └── validators/              ← @vorsa/validators — shared Zod schemas
│       └── src/index.ts         ← All request validation schemas
│
├── src/                         ← v1 Electron app (UNTOUCHED — do not modify)
│   ├── main/                    ← Electron main process
│   ├── renderer/                ← Vite + React + Ant Design UI
│   └── server/                  ← Express server (desktop mode only)
│
├── turbo.json                   ← Turborepo pipeline
├── pnpm-workspace.yaml          ← pnpm workspace config
└── package.json                 ← Root (workspaces + cloud:dev/build scripts)
```

---

## 5. Tech Stack

### Backend
| Technology | Version | Role |
|---|---|---|
| **Hono** | ^4.x | HTTP framework (edge-compatible, replaces Express) |
| **@hono/node-server** | ^1.x | Node.js adapter for Hono |
| **@hono/clerk-auth** | ^2.x | Clerk JWT middleware for Hono |
| **@hono/zod-validator** | ^0.4.x | Request body validation middleware |
| **Drizzle ORM** | ^0.33.x | Type-safe query builder |
| **@neondatabase/serverless** | ^0.10.x | Neon HTTP PostgreSQL driver |
| **Clerk SDK** | (via hono middleware) | Auth provider |
| **@upstash/ratelimit** | ^2.x | Redis-backed rate limiting |
| **@upstash/redis** | ^1.x | Upstash Redis client |
| **Zod** | ^3.23.x | Schema validation |

### Database
| Technology | Role |
|---|---|
| **PostgreSQL** (Neon) | Primary database (serverless, connection pooling built-in) |
| **Drizzle Kit** | Schema migrations (`db:push`, `db:generate`, `db:migrate`, `db:studio`) |

### Frontend
| Technology | Version | Role |
|---|---|---|
| **Next.js** | 15.1.0 | React framework with App Router |
| **React** | ^19.0.0 | UI library |
| **@clerk/nextjs** | ^5.x | Auth components + middleware |
| **@tanstack/react-query** | ^5.51.x | Server state management |
| **Tailwind CSS** | ^4.0.0 | CSS framework (CSS-first `@theme`) |
| **Lucide React** | ^0.400.x | Icon set |
| **clsx + tailwind-merge** | latest | Conditional class utilities |

### Infrastructure (configured, environment-dependent)
| Technology | Role |
|---|---|
| **Upstash Redis** | Rate limiting (falls back gracefully if not configured) |
| **Cloudflare R2** | File/image storage (env vars prepared in `env.ts`) |
| **Trigger.dev** | Background jobs (invite emails, notifications — stubs in place) |
| **Typesense** | Full-text search (future: patient/appointment search) |
| **Ably** | Realtime (future: live appointment board) |

### Monorepo
| Technology | Role |
|---|---|
| **Turborepo** | Task pipeline (build, dev, typecheck, db:*) |
| **pnpm workspaces** | Package manager with `workspace:*` references |

---

## 6. Backend (apps/api)

### Middleware Stack

Every request passes through this chain (defined in `apps/api/src/app.ts`):

```
Request
  → secureHeaders()          [X-Frame-Options, CSP, HSTS etc.]
  → cors()                   [CORS_ORIGIN env var]
  → logger()                 [Hono built-in request logger]
  → clerkMiddleware()         [Validates Clerk JWT on all routes]
  → rateLimiter()             [Upstash sliding window, per-IP]
  → /api/v2/* router
       → requireAuth          [Per-route: verifies Clerk + looks up staff row]
       → requireMinRole()     [Per-route: role hierarchy check]
       → planGuard()          [Per-route: plan limit enforcement]
       → zValidator()         [Per-route: Zod body validation]
       → handler()
  → notFound()               [404 JSON response]
  → onError()                [Catches all errors → structured JSON]
```

### API Routes Reference

All routes are mounted under **`/api/v2`**.

#### `POST /auth/register`
Creates a new clinic tenant. Requires a valid Clerk session (user must sign up via Clerk first). Provisions: clinic → settings → branch → working hours → appt config → owner staff record.

**Body:** `{ clinic_name, owner_name, owner_email, owner_phone?, timezone? }`
**Auth:** Clerk session (no staff row required yet)
**Returns:** `{ clinic, branch, owner }`

#### `GET /auth/me`
Returns the authenticated staff member's profile joined with clinic plan info.

**Auth:** requireAuth
**Returns:** `{ id, name, email, role, branch_id, plan, clinic_name, ... }`

#### `PATCH /auth/me/profile`
Updates the current user's own name, phone, or designation.

---

#### `GET /branches`
Lists branches. `clinic_owner` sees all; others see only their assigned branch.

#### `POST /branches` `[clinic_owner, plan-gated]`
Creates a branch. Blocked if plan's branch limit is reached (HTTP 402). Seeds working hours (Mon–Fri) and default appt config automatically.

#### `GET /branches/:id`
#### `PATCH /branches/:id` `[branch_manager+]`
#### `DELETE /branches/:id` `[clinic_owner]`
Soft-delete (sets `is_active: false`).

#### `GET /branches/:id/working-hours`
#### `PUT /branches/:id/working-hours` `[branch_manager+]`
Atomically replaces all 7 days of working hours.

#### `GET /branches/:id/appt-config`
#### `PATCH /branches/:id/appt-config` `[branch_manager+]`
Controls `default_slot_minutes`, `buffer_minutes`, `max_advance_days`, `auto_confirm`.

#### `GET /branches/:id/chairs`
#### `POST /branches/:id/chairs` `[branch_manager+, plan-gated]`
#### `PATCH /branches/:id/chairs/:chairId` `[branch_manager+]`

#### `GET /branches/:id/custom-statuses`
#### `POST /branches/:id/custom-statuses` `[branch_manager+]`
Upserts by `(clinic_id, label)` — idempotent.

---

#### `GET /staff`
#### `POST /staff` `[branch_manager+]`
Creates staff. If `role === 'doctor'`, applies doctor plan limit inline.

#### `GET /staff/:id`
#### `PATCH /staff/:id` `[branch_manager+]`
#### `DELETE /staff/:id` `[clinic_owner]`
Prevents self-deactivation. Soft-delete only.

#### `POST /staff/invite` `[clinic_owner]`
Creates an invite record (7-day expiry). Checks for duplicate active invites. TODO: triggers Trigger.dev email job.

#### `POST /staff/accept-invite`
Links a Clerk user ID to a new staff record. Marks invite as accepted.

---

#### `GET /patients?q=&page=&limit=`
Search by name or phone. Paginated. Excludes archived patients.

#### `POST /patients` `[plan-gated on patient count]`
#### `GET /patients/:id`
#### `PATCH /patients/:id`
#### `DELETE /patients/:id` `[clinic_owner]`
Archives (sets `archived_at`) — never hard-deleted.

#### `GET/POST /patients/:id/allergies`
#### `DELETE /patients/:id/allergies/:allergyId`
#### `GET/POST /patients/:id/medications`
#### `PATCH/DELETE /patients/:id/medications/:medId`
#### `GET /patients/:id/dental-chart`
#### `PUT /patients/:id/dental-chart`
Upserts by `(patient_id, tooth_number)`.

#### `GET/POST /patients/:id/assessments`

---

#### `GET /appointments?dateFrom=&dateTo=&doctorId=&branchId=&patientId=`
#### `POST /appointments`
#### `GET /appointments/:id`
#### `PATCH /appointments/:id`
#### `DELETE /appointments/:id`
Sets status to `cancelled` (soft delete).

#### `GET /appointments/slots?doctorId=&branchId=&date=`
Generates available slots based on branch working hours, appt config slot duration, and existing bookings.

#### `GET/POST /appointments/treatments`
#### `PATCH /appointments/treatments/:treatId` `[branch_manager+]`
Treatment catalogue (also mirrored at `/settings/treatments`).

#### `GET/POST /appointments/custom-fields` `[branch_manager+]`

#### `GET/POST /appointments/:id/treatment-records`

---

#### `GET /billing/invoices?status=&patientId=&dateFrom=&dateTo=&page=&limit=`
#### `POST /billing/invoices`
Computes subtotal → discount → tax → total automatically from line items.

#### `GET /billing/invoices/:id`
Returns invoice with embedded `items[]` and `payments[]`.

#### `PATCH /billing/invoices/:id`
Blocked if status is `void`.

#### `DELETE /billing/invoices/:id` `[clinic_owner]`
Voids invoice (sets status to `void`).

#### `POST /billing/invoices/:id/payments`
Records payment, recomputes `amount_paid`, updates status to `partial` or `paid`.

#### `GET /billing/invoices/:id/payments`
#### `GET /billing/ledger?dateFrom=&dateTo=` `[branch_manager+]`
Revenue grouped by payment method + grand total.

---

#### `GET /inventory/items?branchId=&category=&lowStock=true`
#### `POST /inventory/items` `[branch_manager+]`
#### `GET /inventory/items/:id`
#### `PATCH /inventory/items/:id` `[branch_manager+]`
#### `DELETE /inventory/items/:id` `[clinic_owner]`

#### `GET /inventory/items/:id/transactions`
#### `POST /inventory/items/:id/transactions` `[branch_manager+]`
Types: `in` (adds stock), `out` (deducts — errors if insufficient), `adjustment` (sets exact value). Saves `stock_before` and `stock_after` for audit trail.

#### `GET /inventory/alerts`
Items where `current_stock ≤ reorder_level`.

---

#### `GET /settings/clinic`
Returns clinic row + settings row together.

#### `PATCH /settings/clinic` `[clinic_owner]`
Splits update: clinic-level fields (`name`) go to `clinics` table; rest go to `clinicSettings` (upserted).

#### `GET/POST /settings/treatments` `[branch_manager+]`
#### `PATCH /settings/treatments/:id` `[branch_manager+]`
#### `DELETE /settings/treatments/:id` `[clinic_owner]`

#### `GET /settings/audit-log?page=&limit=` `[clinic_owner]`
Paginated audit log for the clinic.

---

#### `GET/PATCH /customisation/notation` `[clinic_owner]`
Values: `fdi` | `universal` | `palmer`

#### `GET/PATCH /customisation/currency` `[clinic_owner]`
Fields: `currency_code`, `currency_symbol`, `tax_label`, `tax_rate`

#### `GET/PATCH /customisation/payment-methods` `[clinic_owner]`
Array of accepted method strings.

#### `GET/PATCH /customisation/modules` `[clinic_owner]`
Module toggle map: `{ inventory, billing, analytics, dental_chart, ... }`

#### `GET/POST /customisation/templates`
#### `PATCH/DELETE /customisation/templates/:id`
#### `POST /customisation/templates/:id/apply`
Simple `{{variable_name}}` substitution engine.

---

#### `GET /analytics/revenue?dateFrom=&dateTo=` `[Business+]`
Grand total, by payment method, daily trend.

#### `GET /analytics/appointments?dateFrom=&dateTo=` `[Business+]`
Total, by status, by doctor.

#### `GET /analytics/patients?dateFrom=&dateTo=` `[Business+]`
Total, new in period, returning.

#### `GET /analytics/procedures?dateFrom=&dateTo=` `[Business+]`
Top 20 treatments by revenue.

#### `GET /analytics/doctors?dateFrom=&dateTo=` `[Business+]`
Per-doctor appointment count and completion rate.

#### `GET /analytics/overview` `[Business+]`
Combined KPI snapshot (current month): revenue, appointments, total patients, new patients.

---

### RBAC & Role Hierarchy

```
clinic_owner  (rank 4)  — Full access to everything
branch_manager (rank 3) — Branch operations, staff management within branch
doctor         (rank 2)  — Own appointments, own patient notes
receptionist   (rank 1)  — Scheduling, patient lookup, basic billing
```

**`requireRole(...roles)`** — exact role match
**`requireMinRole(minRole)`** — allows `minRole` and above (hierarchy check)
**`requireBranchAccess()`** — non-owners are scoped to their `branch_id` automatically

---

### Plan Enforcement

Implemented in `apps/api/src/middleware/planGuard.ts`. Returns **HTTP 402** with an upgrade prompt when a plan limit is reached.

| Resource | Starter | Business | Enterprise |
|---|---|---|---|
| Branches | 1 | 5 | Unlimited |
| Doctors | 2 | 15 | Unlimited |
| Patients | 2,000 | 20,000 | Unlimited |
| Chairs | 3 | 20 | Unlimited |

The `planGuard('resource')` middleware is attached **before** the creation handler. It:
1. Queries clinic plan from DB
2. Counts active resources of that type
3. If `current >= limit`, returns 402 with `{ upgrade: true, current, limit, plan }`
4. If Enterprise (limit ≥ 999,999), skips DB count entirely for performance

**`requirePlan('business', 'enterprise')`** gates entire route groups (used on all `/analytics` routes).

---

### Auth Flow (Clerk)

```
User signs up → Clerk hosted UI → Clerk userId created
User calls POST /auth/register → supplies clinic info
  → registerClinic() provisions the full tenant
  → staff row created with clerk_user_id = auth.userId

Subsequent requests:
  → Clerk JWT in Authorization: Bearer header
  → requireAuth middleware calls getAuth(c) → userId
  → Looks up staff by clerk_user_id
  → Sets c.var.staffId, clinicId, role, branchId
  → Handler runs with full typed context
```

There are **no passwords, no refresh tokens, no custom JWT** in v2. Clerk handles all of that. The only credential stored in the Vorsa DB is the `clerk_user_id` foreign key on the `staff` table.

---

## 7. Database (packages/db)

### Schema Overview

The database is PostgreSQL hosted on **Neon** (serverless, HTTP-based). Drizzle ORM provides the type-safe query layer.

Connection:
```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

### All Tables

#### `clinics`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | `gen_random_uuid()` |
| `name` | text | Clinic display name |
| `plan` | enum | `starter` \| `business` \| `enterprise` |
| `is_active` | boolean | Soft enable/disable |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

#### `clinic_settings`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK → clinics) | Unique |
| `tooth_notation` | text | `fdi` \| `universal` \| `palmer` |
| `currency_code` | text | `USD`, `GBP`, `INR`, etc. |
| `currency_symbol` | text | `$`, `£`, `₹`, etc. |
| `tax_label` | text | `VAT`, `GST`, `Tax` |
| `tax_rate` | text | Decimal string e.g. `"18"` |
| `payment_methods` | jsonb | `["cash", "card", ...]` |
| `modules_enabled` | jsonb | `{ inventory: true, ... }` |
| `templates` | jsonb | Array of template objects |

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `staff_id` | uuid (FK) | Who performed the action |
| `action` | text | e.g. `patient.updated` |
| `entity` | text | e.g. `patient` |
| `entity_id` | uuid | Which record |
| `meta` | jsonb | Arbitrary action metadata |
| `ip_address` | text | |
| `created_at` | timestamp | |

#### `branches`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `name` | text | |
| `address` | text | |
| `phone` | text | |
| `email` | text | |
| `is_active` | boolean | |
| `created_at` / `updated_at` | timestamp | |

#### `branch_working_hours`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `branch_id` | uuid (FK) | |
| `day_of_week` | smallint | 0=Sun … 6=Sat |
| `is_open` | boolean | |
| `open_time` | time | e.g. `"09:00"` |
| `close_time` | time | e.g. `"18:00"` |

Unique constraint: `(branch_id, day_of_week)`

#### `appt_config`
| Column | Type | Notes |
|---|---|---|
| `branch_id` | uuid (FK, PK) | One row per branch |
| `default_slot_minutes` | smallint | Default: 30 |
| `buffer_minutes` | smallint | Gap between slots |
| `max_advance_days` | smallint | How far ahead booking allowed |
| `auto_confirm` | boolean | Auto-confirm on booking |

#### `appt_custom_statuses`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `label` | text | |
| `color` | text | Hex colour |
| `is_terminal` | boolean | Ends appointment lifecycle |
| `sort_order` | smallint | |

Unique constraint: `(clinic_id, label)`

#### `chairs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `branch_id` | uuid (FK) | |
| `name` | text | e.g. `"Chair 1"` |
| `is_active` | boolean | |

#### `staff`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `branch_id` | uuid (FK, nullable) | Null = unassigned (clinic_owner) |
| `clerk_user_id` | text (unique) | Links to Clerk user |
| `name` | text | |
| `email` | text | |
| `phone` | text | |
| `role` | enum | `clinic_owner` \| `branch_manager` \| `doctor` \| `receptionist` |
| `designation` | text | e.g. `"Orthodontist"` |
| `is_active` | boolean | |

#### `staff_invites`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Used as invite token |
| `clinic_id` | uuid (FK) | |
| `email` | text | Invitee email |
| `role` | enum | Role to assign on accept |
| `branch_id` | uuid | Branch to assign |
| `expires_at` | timestamp | 7 days from creation |
| `accepted_at` | timestamp | Null until accepted |

#### `patients`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `name` | text | |
| `email` / `phone` | text | |
| `date_of_birth` | date | |
| `gender` | text | |
| `address` | text | |
| `blood_group` | text | |
| `emergency_contact_name` / `phone` | text | |
| `notes` | text | |
| `archived_at` | timestamp | Null = active |
| `created_at` / `updated_at` | timestamp | |

#### `allergies`
`(id, patient_id, clinic_id, name, severity, notes, created_at)`

#### `medications`
`(id, patient_id, clinic_id, name, dosage, frequency, notes, is_active, created_at, updated_at)`

#### `dental_chart_entries`
`(id, patient_id, clinic_id, tooth_number, condition, surface, notes, created_at, updated_at)`
Unique: `(patient_id, tooth_number)`

#### `clinical_assessments`
`(id, patient_id, clinic_id, recorded_by, chief_complaint, clinical_notes, diagnosis, treatment_plan, created_at)`

#### `treatments`
`(id, clinic_id, name, code, default_price, duration_minutes, category, description, created_at, updated_at)`

#### `appointments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` | uuid (FK) | |
| `branch_id` | uuid (FK) | |
| `patient_id` | uuid (FK) | |
| `doctor_id` | uuid (FK → staff) | |
| `chair_id` | uuid (FK → chairs, nullable) | |
| `start_time` | timestamp | |
| `end_time` | timestamp | |
| `status` | text | `scheduled` \| `confirmed` \| `completed` \| `cancelled` \| `no_show` |
| `notes` | text | |
| `custom_fields` | jsonb | Answers to clinic custom fields |

#### `treatment_records`
`(id, appointment_id, clinic_id, treatment_id, tooth_number, surface, notes, price, created_at)`

#### `custom_fields`
`(id, clinic_id, label, field_type, is_required, options jsonb, sort_order, created_at)`

#### `invoices`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` / `branch_id` / `patient_id` | uuid (FK) | |
| `appointment_id` | uuid (FK, nullable) | |
| `subtotal` / `discount_amount` / `tax_rate` / `tax_amount` / `total_amount` / `amount_paid` | text | Decimal strings |
| `status` | text | `draft` \| `sent` \| `paid` \| `partial` \| `void` |
| `notes` / `due_date` | text / date | |

#### `invoice_items`
`(id, invoice_id, clinic_id, treatment_id, description, quantity, unit_price, line_total, created_at)`

#### `payments`
`(id, invoice_id, clinic_id, amount, payment_method, reference, notes, paid_at, created_at)`

#### `inventory_items`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `clinic_id` / `branch_id` | uuid (FK) | |
| `name` | text | |
| `sku` / `category` / `unit` | text | |
| `current_stock` / `reorder_level` / `unit_cost` | text | Decimal strings |
| `is_active` | boolean | |

#### `inventory_transactions`
`(id, item_id, clinic_id, transaction_type [in/out/adjustment], quantity, stock_before, stock_after, recorded_by, notes, reference, created_at)`

---

## 8. Shared Packages

### `@vorsa/types`
All shared TypeScript interfaces and constants. Used by both `apps/api` and `apps/web`.

Key exports:
- `CloudRole` — `'clinic_owner' | 'branch_manager' | 'doctor' | 'receptionist'`
- `ClinicPlan` — `'starter' | 'business' | 'enterprise'`
- `PLAN_LIMITS` — `Record<ClinicPlan, { branches, doctors, patients, chairs }>`
- All entity interfaces: `Clinic`, `Branch`, `StaffMember`, `Patient`, `Appointment`, `Invoice`, `Payment`, etc.
- `ApiResponse<T>`, `PagedResponse<T>`, `ApiErrorResponse`

### `@vorsa/validators`
Zod schemas for all API request bodies. Validates input before it hits the database.

Key schemas:
- `RegisterClinicSchema` — clinic registration
- `CreateBranchSchema`, `UpdateBranchSchema`, `WorkingHoursSchema`, `ApptConfigSchema`, `CreateChairSchema`, `UpsertCustomStatusSchema`
- `CreateStaffSchema`, `UpdateStaffSchema`, `InviteStaffSchema`
- `CreatePatientSchema`, `UpdatePatientSchema`
- `CreateAppointmentSchema`, `UpdateAppointmentSchema`
- `CreateInvoiceSchema`, `RecordPaymentSchema`
- `CreateInventoryItemSchema`, `RecordInventoryTransactionSchema`
- `NotationUpdateSchema`, `CurrencyUpdateSchema`, `ModulesUpdateSchema`

---

## 9. Frontend (apps/web)

### Route Groups

Next.js 15 App Router uses **route groups** (parenthesised directories) to apply different layouts without affecting the URL path.

```
/                    → redirect to /dashboard
/sign-in             → Clerk SignIn component (public)
/sign-up             → Clerk SignUp component (public)
/dashboard           → KPI overview (protected)
/patients            → Patient list with search + pagination (protected)
/patients/:id        → Patient detail: demographics, allergies, meds, chart (protected)
/scheduler           → Day-view appointment list with date navigation (protected)
/billing             → Invoice list with status filter (protected)
/analytics           → Revenue, appointments, patients charts (Business+ only)
/settings            → Tabbed settings panel (protected, owner-sensitive actions)
```

**Clerk middleware** (`middleware.ts`) protects all routes except `/sign-in` and `/sign-up` using `auth.protect()`.

### All Pages

| Page | Key Features |
|---|---|
| **Dashboard** | 4 KPI cards (revenue, appointments, total patients, new patients) pulled from `/analytics/overview`. Quick links to scheduler, billing, inventory. Loading skeletons. |
| **Patients List** | Debounced search by name/phone. Paginated table with avatar initials. Avatar with `getInitials()`. Link to detail page. |
| **Patient Detail** | Header card with demographics. Allergies section (severity badge). Current medications. Dental chart placeholder. All data fetched in parallel. |
| **Scheduler** | Day navigator (← today →). Lists appointments sorted by start time. Status colour chips. Appointment duration shown. |
| **Billing** | Status filter buttons (all/draft/sent/partial/paid/void). Invoice table with amounts, status chips. Pagination. |
| **Analytics** | Plan-gate error state for non-Business users. Revenue by method bar chart (CSS). Appointment by status bars. Daily revenue trend bars (dynamic height). |
| **Settings** | 5-tab panel: Clinic Info, Tooth Notation (radio), Currency & Tax (inputs + save), Payment Methods (checkboxes + save), Modules (toggle switches). All backed by real PATCH API calls. |

### Design System

Tailwind CSS v4 with CSS-first `@theme` in `app/globals.css`. No `tailwind.config.js` needed.

**Design tokens defined:**
```css
--color-brand-{50..900}   /* Blue brand palette */
--color-surface           /* #fff */
--color-surface-muted     /* #f8fafc */
--color-border            /* #e2e8f0 */
--color-text-primary      /* #0f172a */
--color-text-secondary    /* #475569 */
--color-text-muted        /* #94a3b8 */
--color-success/warning/error/info
--color-appt-{status}     /* Per-status appointment colours */
--sidebar-width: 240px
--font-sans: 'Inter', ...
```

**`lib/utils.ts` helpers:**
- `cn(...classes)` — clsx + tailwind-merge
- `formatCurrency(amount, symbol, decimals)` — `$1,234.00`
- `formatDate(date)` — `Jan 15, 2024`
- `formatTime(date)` — `09:30 AM`
- `getInitials(name)` — `"John Smith"` → `"JS"`
- `truncate(text, maxLength)`
- `APPT_STATUS_COLOURS` — Tailwind class map per status

**`lib/api.ts`:**
- `useApi()` hook — returns `{ get, post, patch, put, delete }` with auto-injected Clerk token
- `apiFetch(path, options)` — server-side fetch for Server Components / Route Handlers

---

## 10. Commit History

| Hash | Commit Message | Key Changes |
|---|---|---|
| `c0adcfe` | `feat(v2): complete PRD §12 tech stack migration` | All routers, services, Next.js 15 app, Tailwind v4, full monorepo config |
| `137924f` | `feat(cloud): implement PRD §6, §8, §9.5, §10, §13` | Analytics dashboard, global settings, onboarding wizard, design tokens, migration CLI, plan enforcement |
| `60ea6b6` | `feat: complete SaaS cloud v2 backend and frontend scaffolding` | Initial v2 scaffolding — DB schema, middleware, base structure |

All 3 commits are on top of the existing Electron app commit history and do not rewrite any master branch commits.

---

## 11. Environment Variables

### `apps/api/.env` (required)

```env
# Clerk
CLERK_SECRET_KEY=sk_live_...

# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/vorsa?sslmode=require

# CORS
CORS_ORIGIN=http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

### `apps/api/.env` (optional — features degrade gracefully without these)

```env
# Upstash Redis (rate limiting — disabled if absent)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx

# Rate limit config
RATE_LIMIT_WINDOW=10 s
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=20

# Cloudflare R2 (file storage)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=vorsa-files
R2_PUBLIC_URL=
```

### `apps/web/.env.local`

```env
# Clerk (public key for frontend)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Clerk redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v2
```

---

## 12. Getting Started

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- A Clerk account (free tier works) → create app → copy keys
- A Neon account (free tier) → create project → copy connection string

### Setup

```bash
# 1. Switch to the feature branch
git checkout feature/v2-saas-cloud

# 2. Install all workspace dependencies
pnpm install

# 3. Create env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# → Fill in CLERK_SECRET_KEY, DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# 4. Push DB schema to Neon (no migration files needed for initial setup)
pnpm db:push

# 5. Start both API and web in dev mode
pnpm cloud:dev
```

### Individual package dev

```bash
# API only
pnpm --filter @vorsa/api dev

# Web only
pnpm --filter @vorsa/web dev

# Drizzle Studio (DB GUI)
pnpm db:studio
```

### Production build

```bash
pnpm cloud:build
```

---

## 13. Comparison: v1 vs v2

| Feature | v1 (master — Electron) | v2 (this branch — Cloud) |
|---|---|---|
| **Deployment** | Desktop install per machine | Web browser, any device |
| **Multi-tenancy** | Single clinic, single machine | Unlimited clinics, isolated |
| **Multi-branch** | No | Yes (plan-gated) |
| **Multi-doctor** | Limited | Yes (plan-gated) |
| **Auth** | Custom JWT + bcrypt, stored locally | Clerk — passwordless, SSO-ready |
| **Database** | SQLite (local file) | PostgreSQL on Neon (cloud, replicated) |
| **Offline support** | Full | No (requires internet) |
| **Plan tiers** | None | Starter / Business / Enterprise |
| **Analytics** | Basic inline | Dedicated analytics module (Business+) |
| **API** | Express, no versioning | Hono `/api/v2/`, typed context |
| **Frontend** | Ant Design + Vite | Next.js 15 + Tailwind CSS v4 |
| **Search** | None | Typesense (planned) |
| **Realtime** | None | Ably (planned) |
| **Background jobs** | None | Trigger.dev (planned) |
| **File storage** | Local disk | Cloudflare R2 (planned) |

---

## 14. Merging & Release Plan

This branch should **not** be merged to `master` until:

1. ✅ All API routes implemented ← **DONE**
2. ✅ Database schema complete ← **DONE**
3. ✅ Next.js web app scaffolded ← **DONE**
4. ⬜ Clerk keys configured and auth tested end-to-end
5. ⬜ Neon database provisioned and `db:push` verified
6. ⬜ Tenant registration flow tested (register → login → /me)
7. ⬜ Billing flow tested (create invoice → record payment → ledger)
8. ⬜ Analytics plan-gate verified (402 on Starter)
9. ⬜ Production build passes (`pnpm cloud:build`)
10. ⬜ CI/CD pipeline configured (GitHub Actions for Vercel + Fly.io/Railway deploy)
11. ⬜ Remove `src/` Electron code (or move to `apps/desktop/`)
12. ⬜ Merge strategy decision: squash-merge vs rebase

**Recommended merge strategy:** Squash all 3 feature branch commits into a single clean `feat: vorsa cloud v2 SaaS platform` commit on master, keeping the git history clean.
