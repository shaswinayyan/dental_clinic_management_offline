# VORSA Dental Clinic Management — Cloud SaaS PRD
## From On-Premise Electron to Multi-Tenant Global SaaS

---

**Product Name:** VORSA Dental Clinic Management  
**Document Version:** 1.1  
**Status:** Approved for Development  
**Classification:** Internal — Confidential  
**Predecessor Document:** Clinic Management Software PRD v1.1 (Electron / On-Premise)

---

## Table of Contents

1. [Executive Summary & Migration Strategy](#1-executive-summary--migration-strategy)
2. [Migration Approach — Phase Plan](#2-migration-approach--phase-plan)
3. [Product Vision — VORSA SaaS](#3-product-vision--vorsa-saas)
4. [What Changes from v1.x (On-Premise)](#4-what-changes-from-v1x-on-premise)
5. [Multi-Tenancy Architecture](#5-multi-tenancy-architecture)
6. [Global Customisation Engine](#6-global-customisation-engine)
7. [Multi-Branch & Multi-Doctor System](#7-multi-branch--multi-doctor-system)
8. [SaaS Subscription & Tenant Onboarding](#8-saas-subscription--tenant-onboarding)
9. [Module Expansions for SaaS](#9-module-expansions-for-saas)
10. [Design System — VORSA Brand](#10-design-system--vorsa-brand)
11. [Security, Compliance & Data Residency](#11-security-compliance--data-residency)
12. [Infrastructure & Tech Stack](#12-infrastructure--tech-stack)
13. [Database Migration Strategy](#13-database-migration-strategy)
14. [API Design & Integration Layer](#14-api-design--integration-layer)
15. [DevOps, CI/CD & Observability](#15-devops-cicd--observability)
16. [SaaS Business Model](#16-saas-business-model)
17. [Rollout & Go-To-Market Plan](#17-rollout--go-to-market-plan)
18. [Risk Register](#18-risk-register)
19. [Glossary](#19-glossary)

---

## 1. Executive Summary & Migration Strategy

VORSA is transitioning from a single-clinic, offline-first Electron desktop application to a **globally available, multi-tenant cloud SaaS platform** for dental clinic management. The platform is designed to serve dental practices of every scale — from solo practitioners to large multi-branch networks — anywhere in the world, with deep customisation to match local clinical workflows, regulatory requirements, and billing standards.

### Why Now

The Electron v1.x system has validated the core product: the dental chart, scheduling logic, and billing flows work. The codebase is React-based, which means the frontend is already portable to the web with minimal rework. The SQLite schema is mature and can be migrated to PostgreSQL without structural changes for most tables.

### Migration Philosophy: Strangler Fig, Not Big Bang

The migration follows the **Strangler Fig pattern** — the new cloud system is built alongside the existing Electron app, not instead of it. Existing customers continue on Electron v1.x while the SaaS platform is built and validated. When the SaaS is stable, a migration tool exports their Electron SQLite database and imports it into their new cloud tenant. No forced cutover. No data loss.

### The Three-Phase Roadmap

| Phase | Scope | Duration | Outcome |
|-------|-------|----------|---------|
| **Phase 1 — Foundation** | Cloud infra, auth, multi-tenancy, port core modules | Months 1–4 | Private beta with 3–5 pilot clinics |
| **Phase 2 — Parity + Customisation** | Feature parity with v1.x + global config engine | Months 5–8 | Public beta, all regions |
| **Phase 3 — Scale** | AI features, marketplace, analytics, multi-region | Months 9–16 | GA launch, growth mode |

---

## 2. Migration Approach — Phase Plan

### Phase 1 — Foundation (Months 1–4)

**Goal:** Get the cloud infrastructure running with a working multi-tenant system that pilot clinics can use daily.

#### Infrastructure Setup
- Provision cloud infrastructure on AWS (primary) with Terraform IaC
- Set up PostgreSQL RDS (multi-AZ) for the tenant database layer
- Configure S3 (or compatible) for patient image and document storage
- Set up the authentication service (Clerk or Auth0) with RBAC from day one
- Establish the CI/CD pipeline (GitHub Actions → staging → production)

#### Codebase Migration
- Extract the React frontend from the Electron shell; deploy as a standalone Next.js 14 application
- Replace Electron IPC calls with REST API calls to a new NestJS backend
- Replace SQLite with PostgreSQL; run the schema migration scripts (see Section 13)
- Implement tenant isolation at the database level (schema-per-tenant for Phase 1)

#### Core Modules to Port (Phase 1)
- Authentication & RBAC (Doctor, Receptionist, Branch Manager, Owner)
- Patient Management (registration, dental chart, treatment history)
- Appointment Scheduling (all three chair types, status workflow)
- Basic Billing (invoice generation, partial payments)

#### Deliverables
- Deployed staging and production environments
- Migration CLI tool that reads a VORSA v1.x SQLite `.bak` file and imports it into a new cloud tenant
- Admin dashboard for tenant management (internal use)
- Working private beta for 3–5 invited clinics

---

### Phase 2 — Parity + Customisation (Months 5–8)

**Goal:** Full feature parity with v1.x plus the global customisation engine that makes VORSA usable by any dental clinic worldwide.

#### Features Added
- Payment Ledger and consolidated invoice reports
- Inventory Management (full module from v1.x)
- Treatment Timeline and image comparison viewer
- Global Customisation Engine (see Section 6):
  - Tooth notation system selector (FDI, Universal, Palmer)
  - Currency and tax configuration per tenant
  - Custom treatment catalogue with per-country procedure templates
  - Appointment slot configuration
  - Custom fields on patient records
- Multi-branch support (see Section 7)
- Multi-doctor support with per-doctor scheduling
- Light and dark theme (system-adaptive + manual override)
- Localisation framework (i18n) with initial support for: English, Arabic (RTL), Hindi, Spanish, French, Portuguese, Mandarin

#### Deliverables
- Feature-complete SaaS platform matching v1.x scope
- Public beta launched with self-serve onboarding
- Localisation for 7 languages
- Help documentation portal (user-facing)

---

### Phase 3 — Scale (Months 9–16)

**Goal:** Add intelligence, integrations, and the ecosystem features that make VORSA the definitive global dental ERP.

#### Features Added
- **VORSA Analytics:** Revenue dashboards, patient retention reports, chair utilisation heatmaps, inventory consumption trends
- **AI Clinical Assist:** Auto-suggest procedure codes from clinical notes, anomaly detection on treatment gaps
- **Integration Marketplace:** WhatsApp/SMS reminder integrations, lab management connectors, accounting software (Tally, Xero, QuickBooks)
- **Patient Portal:** Optional web portal for appointment booking and viewing treatment history
- **Multi-region data residency:** EU (Frankfurt), US (Virginia), India (Mumbai), UAE (Dubai), Southeast Asia (Singapore)
- **Offline Mode (PWA):** Service worker-based offline fallback for scheduling and charting when internet is unavailable
- **Custom Report Builder:** Drag-and-drop report creation with export to PDF/Excel

#### Deliverables
- GA (General Availability) launch
- Public developer API with documentation
- Integration marketplace with 5+ connectors
- Multi-region deployment

---

## 3. Product Vision — VORSA SaaS

### Vision Statement

VORSA is the operating system for dental clinics worldwide — a fully customisable, cloud-native ERP that adapts to any practice size, any clinical workflow, any regulatory environment, and any language, while giving clinic owners the intelligence to run a smarter practice.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Clinician-first** | Every workflow is designed around the Doctor's cognitive load. Zero unnecessary clicks before a patient is seated. |
| **Configurable by default** | Nothing is hardcoded except security. Every list, field, and workflow can be customised per tenant. |
| **Globally aware** | Date formats, currencies, tax rules, tooth notation, and compliance requirements adapt to the clinic's country. |
| **Data sovereign** | Clinic owners own their data. Export anytime, in full, in standard formats. No vendor lock-in. |
| **Reliability over features** | 99.9% uptime SLA is non-negotiable. New features ship only after the core is stable. |

---

## 4. What Changes from v1.x (On-Premise)

### Architecture Changes

| Aspect | v1.x (Electron) | v2.x (SaaS) |
|--------|----------------|-------------|
| Deployment | Single machine install | Cloud-hosted, browser-based |
| Database | SQLite (local file) | PostgreSQL (managed cloud, multi-tenant) |
| Auth | bcrypt + local JWT | OAuth 2.0 / OIDC via Clerk/Auth0 |
| File storage | Local filesystem | Object storage (S3/R2) |
| Backup | Manual .bak file | Automated cloud backup + point-in-time recovery |
| Updates | Manual installer | Continuous deployment (zero-downtime) |
| Multi-user | Single machine, shared login | Individual logins per user, concurrent sessions |
| Multi-branch | Not supported | Core feature |
| Offline | Native | PWA offline fallback (Phase 3) |

### Feature Changes

| Feature | v1.x | v2.x |
|---------|------|------|
| Dental chart notation | FDI only | FDI, Universal, Palmer — tenant choice |
| User roles | Doctor + Receptionist | Doctor, Receptionist, Branch Manager, Owner, Custom roles |
| Reports | PDF/CSV export | Live dashboards + scheduled reports |
| Customisation | None | Full ERP-style configuration per tenant |
| Patient reminders | None | SMS/WhatsApp (Phase 3) |
| API access | None | REST + Webhook API (Phase 3) |
| Language | English only | 7+ languages including RTL |

### What Stays the Same (Ported Directly)

- Dental chart logic and FDI notation
- Appointment status workflow (Scheduled → Confirmed → Completed)
- Invoice and partial payment model
- Inventory transaction model
- Treatment Timeline tab
- SOAP clinical assessment format
- Allergy alert system

---

## 5. Multi-Tenancy Architecture

### Isolation Model

VORSA uses a **hybrid multi-tenancy model**:

- **Phase 1–2:** Schema-per-tenant on a shared PostgreSQL cluster (`tenant_{uuid}` schemas). Provides strong logical isolation with simpler infrastructure.
- **Phase 3+:** High-volume tenants (enterprise plans, >500 patients/month) get the option of a dedicated database cluster (database-per-tenant) for performance and compliance.

### Tenant Data Boundaries

Every database table carries a `tenant_id` foreign key. The application layer enforces tenant isolation at the ORM level — no query runs without a tenant context injected by the authenticated session. A middleware layer validates the JWT tenant claim against the requested resource on every API call.

```
Tenant A (schema: tenant_abc123)
├── patients
├── appointments
├── invoices
├── inventory_items
└── ... (all tables scoped to this tenant)

Tenant B (schema: tenant_def456)
├── patients  ← completely isolated
└── ...
```

### Tenant Configuration Store

Each tenant has a `tenant_config` JSON document (stored in a dedicated `tenants` table in the `public` schema) that holds all customisation settings — notation system, currency, timezone, enabled modules, custom fields, etc. This is loaded at session start and cached in the application layer.

### Tenant Onboarding Flow

1. Clinic owner signs up at `app.vorsa.io`
2. Enters clinic name, country, primary language, and plan
3. System provisions a new schema, seeds default data (procedure templates for that country, default roles), and sends a setup wizard link
4. Owner completes the wizard: configure branches, add users, customise treatment catalogue
5. Optional: imports data from VORSA v1.x using the migration tool

---

## 6. Global Customisation Engine

This is the core differentiator that makes VORSA work for any dental clinic in the world. It is an ERP-style configuration layer — not developer customisation, but admin-level configuration accessible from the Settings module.

### 6.1 Clinical Configuration

#### Tooth Notation System
Tenant chooses one notation system at setup (changeable in Settings with a one-time migration):

| System | Used In | Example |
|--------|---------|---------|
| FDI (ISO 3950) | International standard, Europe, Asia, Middle East | Tooth 46 |
| Universal Numbering | United States, Canada | Tooth 30 |
| Palmer Notation | UK, some Commonwealth countries | LR6 |

All internal storage uses FDI. The display layer converts to the tenant's chosen system.

#### Procedure Templates by Region
Pre-loaded procedure catalogues for common markets:

| Region | Template Includes |
|--------|------------------|
| India | GST tax codes, BDS procedure codes, common ₹ pricing tiers |
| USA | ADA CDT codes, USD pricing, insurance procedure flags |
| UAE / GCC | VAT-exempt codes, Arabic procedure names, common Gulf pricing |
| UK | NHS and private treatment categories, GBP pricing |
| EU (Generic) | GDPR compliance flags, Euro pricing |
| Southeast Asia | Common local procedure names, multi-currency support |
| Generic | Blank template; fully manual setup |

These are starting points, not restrictions. Every procedure can be renamed, repriced, or deleted.

#### Custom Clinical Fields
Admins can add custom fields to the following entities:

| Entity | Field Types Supported |
|--------|----------------------|
| Patient record | Text, Number, Date, Dropdown, Checkbox, Multi-select |
| Appointment | Text, Dropdown |
| Treatment entry | Text, Number |
| Invoice | Text, Dropdown |

Custom fields are visible in the UI and included in exports. They are stored in a `custom_fields` JSONB column on each entity table.

---

### 6.2 Business & Billing Configuration

#### Currency & Tax

| Setting | Description |
|---------|-------------|
| Primary currency | ISO 4217 code; drives all pricing displays |
| Secondary currency | Optional; shown alongside primary for multi-currency clinics |
| Tax label | "GST", "VAT", "Sales Tax", or custom |
| Tax rate(s) | Multiple tax bands supported (e.g. 5% basic, 18% composite) |
| Tax inclusive/exclusive | Toggle per item |
| Invoice footer text | Custom legal text for invoices (e.g. tax registration number) |
| Invoice numbering format | Customisable prefix and sequence (e.g. `INV-{YEAR}-{SEQ}`) |

#### Payment Methods
Admin configures which payment methods are active:
- Cash
- UPI (India)
- Card (generic)
- NETS (Singapore)
- STC Pay / Mada (Saudi Arabia)
- Apple Pay / Google Pay
- Insurance (triggers a different billing flow)
- Bank Transfer
- Custom (user-defined label)

---

### 6.3 Scheduling Configuration

Per branch, admins configure:
- Number of chairs (1–20)
- Chair names (e.g. "Surgery 1", "Hygiene Room", "Ortho Chair")
- Default slot duration per chair
- Working hours per day and per doctor
- Holiday calendar (with country-specific public holiday presets)
- Walk-in vs appointment-only toggle per chair
- Buffer time between appointments

---

### 6.4 User Role Builder

Beyond the default roles, tenants on Business and Enterprise plans can create custom roles with granular permissions:

```
Custom Role: "Senior Nurse"
├── Patient records: View + Edit clinical notes
├── Appointments: View + Edit (no cancel)
├── Billing: View only
├── Inventory: View + Record stock out
└── Reports: View only
```

Permissions are defined as: `{module}.{action}` pairs (e.g. `billing.create_invoice`, `inventory.adjust_stock`).

---

### 6.5 Module Enablement

Tenants can enable or disable entire modules based on their subscription plan and clinic type:

| Module | Can Disable? | Notes |
|--------|-------------|-------|
| Patient Management | No | Core |
| Appointment Scheduling | No | Core |
| Billing | No | Core |
| Inventory Management | Yes | Optional add-on on Starter plan |
| Analytics Dashboard | Yes | Business plan and above |
| Patient Portal | Yes | Business plan and above |
| Treatment Timeline | No | Core |
| Custom Fields | Yes | Business plan and above |
| API Access | Yes | Enterprise plan |

---

## 7. Multi-Branch & Multi-Doctor System

### 7.1 Branch (Clinic Location) Model

Each tenant can manage multiple physical clinic locations:

```
VORSA Tenant: "Smile Dental Group"
├── Branch: Downtown Clinic
│   ├── Chairs: Surgery 1, Surgery 2, Hygiene
│   ├── Staff: Dr. Ahmed, Receptionist Priya
│   └── Inventory: Independent stock
├── Branch: Westside Clinic
│   ├── Chairs: Chair A, Chair B
│   ├── Staff: Dr. Fatima, Receptionist James
│   └── Inventory: Independent stock
└── Branch: North Campus
    ├── Chairs: Chair 1, Chair 2, Chair 3
    └── Staff: ...
```

#### Branch-Level Features
- Independent appointment scheduling per branch
- Independent inventory per branch (with cross-branch transfer in Phase 3)
- Branch-level revenue and patient reports
- Branch-specific working hours and chair configuration
- Staff can be assigned to one or multiple branches

#### Cross-Branch Features
- Patients are shared across the entire tenant (one OP ID, visible at all branches)
- A patient's complete treatment history is accessible from any branch
- Owner/Admin can view consolidated reports across all branches
- Inventory transfers between branches (Phase 3)

---

### 7.2 Multi-Doctor Scheduling

In v1.x, there was one implicit doctor. In v2.x, each appointment is linked to a specific doctor.

#### Doctor Profile

| Field | Description |
|-------|-------------|
| Name | Full name |
| Specialisation | General Dentist, Orthodontist, Endodontist, Oral Surgeon, etc. |
| Registration Number | Professional licence/registration ID |
| Branches | Which branches they work at |
| Working Schedule | Per-branch, per-day availability with time slots |
| Signature | For invoices and prescriptions (image upload) |
| Colour Code | For visual differentiation in the scheduler |

#### Doctor-Specific Scheduler

The scheduler view gains a **Doctor filter**:
- View by Doctor (shows all chairs for that doctor across their working hours)
- View by Chair (existing v1.x view, now with doctor assignment per slot)
- View by Day (all doctors, all chairs, full grid)

#### Doctor Workload Dashboard
Each doctor has a personal dashboard showing:
- Today's appointments
- Patients seen this week/month
- Revenue generated (visible to Owner and Doctor themselves)
- Pending clinical notes (appointments completed but SOAP not filled)

---

## 8. SaaS Subscription & Tenant Onboarding

### 8.1 Subscription Plans

| Feature | Starter | Business | Enterprise |
|---------|---------|----------|------------|
| Branches | 1 | Up to 5 | Unlimited |
| Doctors | Up to 2 | Up to 15 | Unlimited |
| Patient records | Up to 2,000 | Up to 20,000 | Unlimited |
| Appointment chairs | Up to 3 | Up to 20 | Unlimited |
| Inventory module | Add-on | Included | Included |
| Analytics dashboard | — | Included | Included |
| Patient portal | — | Included | Included |
| Custom roles | — | Included | Included |
| API access | — | — | Included |
| Custom fields | — | Included | Included |
| Data residency choice | — | — | Included |
| SLA uptime guarantee | 99.5% | 99.9% | 99.95% |
| Support | Email | Priority email + chat | Dedicated CSM |
| Data export | Self-serve | Self-serve | Self-serve + assisted |

### 8.2 Onboarding Flow (Self-Serve)

```
Sign Up
  └─► Country + Plan Selection
        └─► Clinic Setup Wizard
              ├─► Clinic name, logo, address
              ├─► Branch configuration
              ├─► Doctor profiles
              ├─► Chair configuration
              ├─► Treatment catalogue (choose template + customise)
              ├─► Billing setup (currency, tax, payment methods)
              └─► Invite staff (email invitations with role assignment)
                    └─► Dashboard (ready to use)
```

### 8.3 Data Migration from v1.x

A dedicated **Migration Tool** is available for existing VORSA Electron users:

1. In the Electron app (v1.x): Settings → Export for Cloud Migration → generates a `.vorsa` migration archive
2. In the VORSA SaaS onboarding: Upload Migration Archive
3. System validates the archive, maps old schema to new, and imports:
   - All patients with OP IDs preserved
   - All appointments and treatment history
   - All invoices and payment records
   - All inventory items and transactions
   - Clinical images (uploaded to S3)
4. Validation report shown: record counts, any skipped rows with reasons
5. Tenant goes live on SaaS; Electron app can continue as read-only fallback

---

## 9. Module Expansions for SaaS

All modules from v1.x are retained. The following expansions apply in v2.x:

### 9.1 Patient Management Additions

- **Global patient search** across all branches (autocomplete by name, OP ID, phone)
- **Patient merge** tool for duplicate records (Owner/Admin only)
- **Consent forms** — configurable digital consent form templates; patients sign digitally (trackpad/touchscreen) or via a one-time link on their phone
- **Patient tags** — custom labels for patient segments (e.g. "VIP", "Insurance", "Paediatric")
- **Communication log** — record of calls and messages made to the patient
- **Referral tracking** — track which doctor or source referred the patient

### 9.2 Scheduling Additions

- **Recurring appointments** — set up a series (e.g. weekly orthodontic checks for 6 months)
- **Waitlist** — when a slot is full, add patients to a waitlist; notify when a slot opens
- **Appointment notes (pre-procedure)** — doctor-facing notes visible on the day's schedule
- **Block time** — mark chair time as unavailable (lunch, maintenance, training) without creating an appointment
- **Two-way sync** (Phase 3) — optional sync with Google Calendar or Outlook for doctors

### 9.3 Billing Additions

- **Insurance billing flow** — mark procedures as insurance-covered; track insurer name, policy number, coverage amount, and claim status
- **Treatment plan quote** — generate a multi-procedure quote with total cost and payment plan options; patient can accept digitally
- **Recurring payment plans** — split a large invoice into monthly instalments with automatic reminders
- **Multi-currency invoicing** — invoice in a secondary currency for international patients
- **Xero / QuickBooks sync** (Phase 3) — push invoices and payments to accounting software

### 9.4 Inventory Additions (Multi-Branch)

- **Branch transfer requests** — one branch requests items from another; manager approves
- **Centralised purchasing** — create purchase orders across all branches in one workflow
- **Supplier catalogue** — maintain a catalogue of suppliers with product pricing for quick reorder
- **Barcode scanning support** — scan item barcodes for fast stock-in/out recording (via device camera)

### 9.5 Analytics Module (New in v2.x)

Available on Business plan and above.

| Report | Description |
|--------|-------------|
| Revenue Dashboard | Daily/weekly/monthly revenue by branch, doctor, procedure category |
| Appointment Volume | Chair utilisation rates, no-show rates, cancellation rates |
| Patient Retention | New vs returning patients, average visit frequency, lapsed patient list |
| Procedure Mix | Top procedures by volume and revenue |
| Inventory Cost | Material cost per procedure, stock turnover rate |
| Doctor Performance | Appointments completed, revenue generated, patient satisfaction (if reviews enabled) |

All reports support date range filtering and export to PDF or Excel.

---

## 10. Design System — VORSA Brand

The VORSA SaaS UI is derived from the logo's visual language: **deep navy blue as the primary colour, gold as the premium accent, and silver/white as the clean functional surface**. The aesthetic is luxury-professional — confident, calm, and clinical.

### 10.1 Colour Palette

#### Light Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--vorsa-navy` | `#0D1B2A` | Primary brand, top nav background, headings |
| `--vorsa-navy-mid` | `#1A3050` | Sidebar, secondary headers |
| `--vorsa-navy-light` | `#E8EDF3` | Tinted backgrounds, table headers |
| `--vorsa-gold` | `#C9A84C` | Primary CTA buttons, active states, key accents |
| `--vorsa-gold-light` | `#F5EDD6` | Gold tinted surfaces, hover states on gold CTAs |
| `--vorsa-silver` | `#8A98A8` | Muted text, borders, secondary labels |
| `--surface-primary` | `#FFFFFF` | Card backgrounds, panels |
| `--surface-secondary` | `#F4F6F9` | Page background |
| `--surface-tertiary` | `#EDF0F5` | Input backgrounds, alternating table rows |
| `--text-primary` | `#0D1B2A` | Body text |
| `--text-secondary` | `#4A5568` | Labels, captions |
| `--text-muted` | `#8A98A8` | Placeholders, disabled |

#### Dark Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--vorsa-navy` | `#C9A84C` | Gold becomes primary accent in dark mode |
| `--surface-primary` | `#0F1923` | Card backgrounds |
| `--surface-secondary` | `#0A1219` | Page background |
| `--surface-tertiary` | `#162130` | Elevated surfaces, modals |
| `--text-primary` | `#E8EDF3` | Body text |
| `--text-secondary` | `#8A98A8` | Labels |
| `--border-default` | `rgba(255,255,255,0.08)` | Card borders |

### 10.2 Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display / Hero | Playfair Display | 700 | 32–48px |
| Heading H1 | Playfair Display | 600 | 24–28px |
| Heading H2–H3 | DM Sans | 500 | 18–20px |
| Body text | DM Sans | 400 | 14–16px |
| UI labels | DM Sans | 500 | 12–13px |
| Monospace (IDs, codes) | JetBrains Mono | 400 | 12–13px |

### 10.3 Component Rules

- **Buttons:** Primary = gold background (`--vorsa-gold`) + dark text. Secondary = outline navy. Destructive = standard red. Minimum height 40px.
- **Cards:** `border-radius: 12px`, `border: 1px solid var(--border-default)`. No drop shadows in dark mode.
- **Navigation:** Top bar in `--vorsa-navy` with gold active states. Sidebar uses navy-mid with gold accent on active item.
- **Status badges:** Appointment status badges follow the same colour system as v1.x but updated to DM Sans and the new palette.
- **Data tables:** Alternating row fills using surface-secondary/tertiary. Sticky header. Sortable column indicators.
- **Forms:** Input fields 40px height, 12px border-radius, silver border, navy focus ring.

### 10.4 Theme Switching

- Users can choose: Light, Dark, or System (follows OS preference)
- Preference stored in user profile (persists across sessions and devices)
- Theme switch is instant with CSS variable transitions (no flash)
- All VORSA UI components are designed to be equally functional and aesthetically correct in both themes

---

## 11. Security, Compliance & Data Residency

### 11.1 Authentication & Session Management

- **OAuth 2.0 + OIDC** via Clerk (primary) or Auth0 (enterprise option)
- MFA (TOTP or SMS) — required for Owner role, optional for others
- SSO support (SAML 2.0 / Google Workspace / Microsoft 365) — Enterprise plan
- Session timeout: configurable per tenant (15 min – 8 hours)
- Concurrent session limit: configurable
- All tokens short-lived (15 min access token, 7-day refresh token rotation)

### 11.2 Data Encryption

| Layer | Method |
|-------|--------|
| Data in transit | TLS 1.3 on all connections |
| Data at rest (DB) | AES-256 encryption on RDS storage |
| Data at rest (files) | S3 server-side encryption (SSE-S3 or SSE-KMS for Enterprise) |
| Backup data | Encrypted with tenant-specific key |
| Application secrets | AWS Secrets Manager / HashiCorp Vault |

### 11.3 Compliance

| Standard | Target Audience | Status |
|----------|----------------|--------|
| GDPR (EU) | European tenants | Phase 2 |
| PDPA (India) | Indian tenants | Phase 2 |
| HIPAA (USA) | US tenants with PHI | Phase 3 (requires BAA) |
| ISO 27001 | Enterprise tenants | Phase 3 |
| SOC 2 Type II | Enterprise tenants | Phase 3 |
| UAE PDPL | GCC tenants | Phase 2 |

### 11.4 Data Residency

Tenants on the Enterprise plan choose their data region:

| Region | AWS Region | Countries Served |
|--------|-----------|-----------------|
| Asia Pacific (India) | ap-south-1 (Mumbai) | India, Sri Lanka, Nepal |
| Middle East | me-south-1 (Bahrain) | UAE, Saudi Arabia, GCC |
| Europe | eu-central-1 (Frankfurt) | EU, UK |
| US East | us-east-1 (Virginia) | USA, Canada |
| Southeast Asia | ap-southeast-1 (Singapore) | Singapore, Malaysia, Indonesia, Thailand |
| Global (default) | us-east-1 | All others |

On Starter and Business plans, the tenant's country at signup determines the data region automatically.

### 11.5 Audit Logging

- All data mutations logged with: timestamp (UTC), user ID, IP address, action, entity type, entity ID, before/after snapshot
- Audit logs are immutable (append-only, stored separately from tenant data)
- Owners can view their tenant's audit log from Settings
- Logs retained for: 2 years (Starter), 5 years (Business), 7 years (Enterprise)
- Tamper-evident hash chain on audit log entries

---

## 12. Infrastructure & Tech Stack

> **Electron is completely gone.** VORSA SaaS is a cloud-native, browser-first product. No Electron, no desktop runtime, no local SQLite. Every technology choice below is made for the web at scale.

---

### 12.1 Design Principles Behind Stack Selection

| Principle | What it means for stack decisions |
|-----------|----------------------------------|
| **Type-safety end-to-end** | TypeScript everywhere, from DB schema to UI props — no runtime surprises in production |
| **Edge-first delivery** | Static and semi-static pages served from CDN edge nodes near the clinic; zero cold-start latency for doctors mid-consultation |
| **Serverless where it makes sense** | Stateless API workers auto-scale to zero; background jobs isolated from the request path |
| **Observable from day one** | Every layer emits structured logs, traces, and metrics — not bolted on after an incident |
| **Swap-friendly abstractions** | No vendor lock-in at the application layer; infrastructure choices hidden behind interface abstractions so AWS → GCP is a config change, not a rewrite |

---

### 12.2 Full Stack — Layer by Layer

#### Frontend

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Framework** | Next.js (App Router) | 15.x | RSC (React Server Components) for zero-JS dashboards; Streaming SSR for instant first paint; built-in image optimisation; Partial Prerendering (PPR) for hybrid static+dynamic pages |
| **Language** | TypeScript | 5.x | Strict mode enforced; shared types between frontend and backend via a `@vorsa/types` package in the monorepo |
| **UI Components** | shadcn/ui | Latest | Unstyled Radix UI primitives + copy-owned component code — no black-box library to fight when theming to VORSA navy/gold; fully accessible (ARIA, keyboard nav) out of the box |
| **Styling** | Tailwind CSS v4 | 4.x | CSS-first config (no `tailwind.config.js`); native cascade layers; faster build times; VORSA design tokens defined as CSS custom properties, consumed by Tailwind |
| **State — Server** | TanStack Query v5 | 5.x | Smart server state: caching, background refetch, optimistic updates for appointment status changes, stale-while-revalidate for patient lists |
| **State — Client** | Zustand | 4.x | Minimal, non-Redux client state for UI-only things: sidebar collapse, active chair in scheduler, theme preference |
| **Forms** | React Hook Form + Zod | Latest | Zero-re-render form handling; Zod schemas shared with backend validators — same schema validates the form and the API endpoint |
| **Data Tables** | TanStack Table v8 | 8.x | Headless, fully custom-styled; virtual scrolling for patient lists with 10,000+ records; column-level sorting, filtering, and pinning |
| **Dental Chart** | Custom SVG + React | — | Owned component, ported from v1.x; FDI/Universal/Palmer notation switching at the component level; no external charting library needed |
| **Calendar / Scheduler** | Custom (react-use-calendar base) | — | The chair scheduler is too domain-specific for any off-the-shelf calendar library; owned component with day/week/doctor views |
| **Rich Text (SOAP notes)** | Tiptap | 2.x | ProseMirror-based; headless; VORSA-styled toolbar; outputs clean JSON stored in JSONB column; no HTML blobs |
| **PDF (client preview)** | @react-pdf/renderer | 3.x | Client-side PDF preview for invoices before download; server-side generation uses a separate worker (see Backend) |
| **Internationalisation** | next-intl | 3.x | App Router-native i18n; compile-time type-safe translation keys; RTL support via CSS logical properties (`margin-inline-start` etc.) |
| **Analytics (product)** | PostHog (self-hosted or cloud) | Latest | Feature flags, session replay, funnel analysis — ships with a Next.js SDK; used to understand where clinics drop off in onboarding |

---

#### Backend

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Runtime** | Node.js | 22 LTS | Native fetch, native WebSocket, V8 performance; no Bun or Deno for now — ecosystem maturity matters in healthcare |
| **Framework** | Hono | 4.x | **Replaces NestJS.** Hono is 14× faster than Express, runs natively on Cloudflare Workers *and* Node.js *and* AWS Lambda with zero code changes — this is the swap-friendly abstraction. Middleware, routing, typed RPC, and OpenAPI generation built-in. NestJS's decorator magic adds complexity that Hono's explicit, functional style avoids. |
| **API style — Internal** | tRPC v11 | 11.x | End-to-end type safety between the Next.js frontend and Hono backend; no code generation, no OpenAPI round-trip; procedure definitions serve as living API documentation |
| **API style — External (Phase 3)** | OpenAPI 3.1 via Hono's `@hono/zod-openapi` | — | Auto-generates the public REST API spec + interactive docs from the same Zod schemas used for validation |
| **ORM** | Drizzle ORM | Latest | **Replaces Prisma.** Drizzle is SQL-first (you write real SQL, just type-safe); no query engine binary to ship; ~100× faster than Prisma for bulk operations; perfect for multi-schema tenant isolation since schema names are just strings in Drizzle's table definitions; migrations are plain SQL files — transparent and auditable |
| **Database** | Neon PostgreSQL (serverless) | — | **Replaces RDS.** Neon separates storage from compute: scales to zero when idle (cost-efficient for small clinics at 2am), branches instantly for dev/preview environments, built-in point-in-time restore, and supports HTTP-based queries from edge workers. Falls back to standard PostgreSQL wire protocol for heavy workloads. |
| **Connection Pooling** | PgBouncer via Neon's built-in pooler | — | Neon includes connection pooling by default; no separate PgBouncer instance to manage |
| **Background Jobs** | Trigger.dev | 3.x | **Replaces BullMQ + Redis.** Trigger.dev is a cloud-native job runner: durable execution (survives restarts), built-in retries with exponential backoff, job observability in a dashboard, and fan-out for sending reminders to hundreds of patients simultaneously. Zero Redis infrastructure to manage. |
| **File Storage** | Cloudflare R2 + Images | — | **Replaces S3 + CloudFront.** R2 has zero egress fees (critical — patient X-rays and intraoral photos are large files fetched frequently); Cloudflare Images handles resizing, thumbnail generation, and WebP conversion automatically; global CDN included |
| **Authentication** | Clerk | 5.x | Multi-tenant org management, RBAC, MFA, SSO (SAML / Google / Microsoft) — all out of the box; Next.js and Hono SDKs; JWT claims carry `tenant_id` + `role` on every request |
| **Email** | Resend | Latest | Developer-first transactional email (by the react-email team); send React components as emails; deliverability-first infrastructure; replaces SES which requires significant warm-up and reputation management |
| **SMS / WhatsApp** | Twilio | — | Appointment reminders (Phase 3); Twilio's WhatsApp Business API is the only production-grade option for global WhatsApp delivery |
| **Search** | Typesense (self-hosted on Fly.io) | Latest | **Replaces OpenSearch.** Typesense is 10× faster for typeahead search; patient name/OP ID/phone instant search with typo tolerance; far cheaper to run than OpenSearch clusters; schema per tenant supported |
| **Rate Limiting** | Upstash Redis | — | Serverless Redis for rate limiting and short-lived caches (tenant config, session metadata); no Redis cluster to provision; pay-per-request |
| **PDF Generation** | Chromium via `@sparticuz/chromium` + AWS Lambda | — | Puppeteer with the Lambda-optimised Chromium binary; isolated from the main API; invoked as a serverless function per PDF generation request; outputs to R2 |
| **Realtime** | Ably or Soketi (self-hosted Pusher) | — | WebSocket-based realtime for the appointment scheduler: when a receptionist books a slot, all logged-in users on that branch see it update instantly without a page refresh |

---

#### Infrastructure

| Layer | Technology | Why |
|-------|-----------|-----|
| **Cloud Platform** | AWS (primary) + Cloudflare (edge + storage + DNS) | AWS for compute and managed databases; Cloudflare for everything touching the network edge — DNS, CDN, R2 storage, WAF, DDoS protection |
| **Compute** | AWS ECS Fargate (Hono API) + AWS Lambda (PDF, migrations, cron) | Fargate for long-running stateful workloads; Lambda for burst-workload, stateless functions — right tool for each job |
| **IaC** | Terraform (AWS) + Pulumi (Cloudflare resources) | Terraform for mature AWS provider; Pulumi for Cloudflare where TypeScript IaC is more expressive than HCL |
| **Container Registry** | AWS ECR | Private container registry for API and worker images |
| **Secret Management** | AWS Secrets Manager | Database credentials, API keys, signing secrets — never in environment variables or code |
| **Monorepo** | Turborepo | Build orchestration and caching across packages: `apps/web` (Next.js), `apps/api` (Hono), `packages/types` (shared TS types), `packages/db` (Drizzle schema), `packages/ui` (shadcn components) |
| **Package Manager** | pnpm | Workspace protocol, deterministic lockfile, 2–3× faster installs than npm |

---

#### Observability

| Tool | Purpose | What it watches |
|------|---------|----------------|
| **OpenTelemetry** | Instrumentation standard | Traces emitted from Hono middleware, Drizzle queries, Trigger.dev jobs — vendor-neutral |
| **Axiom** | Log aggregation + structured search | Replaces CloudWatch/Datadog Logs; cheaper, faster query UX, native OTel ingest |
| **Baselime** (now part of Cloudflare) | Serverless observability | Lambda cold starts, ECS Fargate p99 latency, error rate dashboards |
| **Sentry** | Error tracking | Frontend JS exceptions + backend unhandled errors with full stack traces and user session context |
| **Checkly** | Synthetic monitoring + uptime | Runs real Playwright scripts against production every 60 seconds from 5 global locations; fires PagerDuty on failure |
| **PagerDuty** | On-call alerting | P1 (data breach / outage) and P2 (elevated error rate) escalation |

---

#### Testing

| Layer | Tool | Scope |
|-------|------|-------|
| Unit + integration | Vitest | Pure functions, Drizzle query logic, Hono route handlers with mock DB |
| Component | React Testing Library | UI component behaviour, form validation, dental chart interactions |
| End-to-end | Playwright | Full user journeys: patient registration → appointment → invoice → payment; runs against a seeded staging DB |
| API contract | Hurl | HTTP-level API integration tests — readable `.hurl` files committed alongside route handlers |
| Visual regression | Chromatic | Storybook component snapshots; catches unintended UI changes on every PR |
| Performance | Lighthouse CI | Core Web Vitals budget enforced on every PR (LCP < 2.5s, CLS < 0.1) |
| Load testing | k6 | Simulate 500 concurrent clinic users on the scheduler and patient search endpoints before each release |
| Tenant isolation | Custom Vitest suite | Runs cross-tenant query attempts against a real test DB; any data leak fails the build |

---

### 12.3 Monorepo Structure

```
vorsa/
├── apps/
│   ├── web/                    # Next.js 15 — the VORSA web application
│   │   ├── app/                # App Router pages and layouts
│   │   │   ├── (auth)/         # Login, signup, onboarding (public)
│   │   │   ├── (app)/          # Authenticated app shell
│   │   │   │   ├── dashboard/
│   │   │   │   ├── patients/
│   │   │   │   ├── scheduler/
│   │   │   │   ├── billing/
│   │   │   │   ├── inventory/
│   │   │   │   └── settings/
│   │   │   └── api/            # Next.js API routes (thin proxy to Hono)
│   │   └── components/         # App-specific components
│   │
│   ├── api/                    # Hono API server
│   │   ├── src/
│   │   │   ├── middleware/     # auth, tenant, rate-limit, logging
│   │   │   ├── routers/        # patients, appointments, billing, inventory
│   │   │   ├── services/       # business logic layer
│   │   │   └── index.ts        # Hono app entry
│   │   └── Dockerfile
│   │
│   └── workers/                # Trigger.dev background jobs
│       ├── pdf-generator.ts
│       ├── backup-scheduler.ts
│       ├── reminder-sender.ts
│       └── analytics-aggregator.ts
│
├── packages/
│   ├── types/                  # Shared TypeScript types (Patient, Appointment, Invoice...)
│   ├── db/                     # Drizzle ORM schema definitions + migration files
│   │   ├── schema/
│   │   │   ├── patients.ts
│   │   │   ├── appointments.ts
│   │   │   ├── billing.ts
│   │   │   ├── inventory.ts
│   │   │   └── index.ts
│   │   └── migrations/         # Plain SQL migration files
│   ├── ui/                     # Shared shadcn/ui components (VORSA-themed)
│   │   ├── button.tsx
│   │   ├── dental-chart.tsx    # The interactive SVG dental chart
│   │   ├── scheduler.tsx
│   │   └── ...
│   ├── validators/             # Zod schemas — shared between frontend forms and API
│   └── i18n/                   # Translation files (en, ar, hi, es, fr, pt, zh)
│
├── infra/
│   ├── terraform/              # AWS: ECS, Lambda, ECR, Secrets Manager
│   └── pulumi/                 # Cloudflare: R2, Images, DNS, WAF rules
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

### 12.4 Architecture — Request Flow

```
Clinic Staff Browser / Mobile Browser
            │
            ▼ HTTPS (TLS 1.3)
  ┌─────────────────────────────┐
  │   Cloudflare Edge Network   │  ← WAF, DDoS protection, bot management
  │   (200+ global PoPs)        │
  └──────────┬──────────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
 Static Assets    Dynamic Pages
 (R2 + CF CDN)   (Next.js on ECS Fargate)
                       │
              Clerk JWT validation
                       │
                       ▼
            ┌──────────────────┐
            │   Hono API       │  ← ECS Fargate (auto-scaled 2–20 tasks)
            │   (Node 22 LTS)  │
            │                  │
            │  Tenant Middleware│  ← Extracts tenant_id from JWT, injects into every query
            │  RBAC Guards     │  ← Role + permission check per route
            └────────┬─────────┘
                     │
        ┌────────────┼───────────────┐
        ▼            ▼               ▼
   Neon PG      Upstash Redis    Typesense
 (serverless,   (rate limiting,  (patient search,
  schema/tenant  config cache)    typeahead)
  isolation)
        │
        ▼
  Trigger.dev Workers (async)
  ├── PDF generation  ──► R2 Storage (Cloudflare)
  ├── Daily backup    ──► R2 Storage (encrypted)
  ├── Reminders       ──► Twilio (SMS/WhatsApp)
  └── Analytics jobs  ──► Neon PG analytics schema

  Realtime Updates
  └── Ably WebSocket ──► All browser sessions on same branch
                         (live scheduler updates, stock alerts)
```

---

### 12.5 Why These Specific Choices Win for VORSA

#### Neon over AWS RDS

RDS Multi-AZ costs ~$200–800/month minimum even when idle. A dental clinic on the Starter plan generating $49/month in revenue cannot subsidise an always-on RDS instance. Neon scales to zero between midnight and 7am (when the clinic is closed), cutting infrastructure costs by 60–70% for small tenants. Database branching means every PR deployment gets an isolated copy of the schema for free — no more shared staging databases causing flaky tests.

#### Hono over NestJS

NestJS is excellent but it carries ~40MB of decorator metadata, reflection overhead, and a module system that makes simple things ceremonious. A Hono API handler for creating an appointment is 15 lines. The equivalent NestJS controller, service, DTO, and module is 100+ lines across 4 files. For a team shipping fast, Hono's simplicity is a strategic advantage. The performance delta (Hono benchmarks at 14× faster than Express) becomes real when 50 clinic users hammer the scheduler simultaneously during morning rush.

#### Drizzle over Prisma

Prisma generates a query engine binary that adds ~30MB to the Docker image and ~200ms to cold starts on Lambda. Drizzle has no binary — it compiles to plain SQL. The schema definition is TypeScript, the migrations are plain `.sql` files that a DBA can read and audit. For a healthcare application where DBAs and compliance teams need to understand exactly what runs against the database, Drizzle's transparency is non-negotiable.

#### Cloudflare R2 over AWS S3

Dental clinics generate large files: CBCT scans can be 200MB+, intraoral photo sessions can be 50–100 images. S3 charges $0.09/GB egress. Every time a doctor opens the Treatment Timeline and loads 12 images, that is billable egress. R2 charges $0.00/GB egress — zero. For an image-heavy medical application, this is not a minor optimisation; it is a structural cost difference that becomes significant at scale.

#### Trigger.dev over BullMQ + Redis

BullMQ requires a Redis instance, a worker process, a UI for job monitoring, and custom retry logic. Trigger.dev gives all of that as a managed service with a built-in dashboard, durable execution (the job survives a worker restart mid-execution), and fan-out primitives for sending bulk appointment reminders. The operational overhead reduction is significant for a small team.

---

### 12.6 Technology Maturity & Lock-in Assessment

| Technology | Maturity | Lock-in Risk | Fallback |
|-----------|---------|-------------|---------|
| Next.js 15 | High | Medium (Vercel ecosystem pull) | Deploy to any Node host; no Vercel-specific APIs used |
| Hono | Medium-High | Low | Standard HTTP; swap to Fastify in a sprint |
| Drizzle ORM | Medium | Low | Plain SQL migrations; swap ORM without touching DB |
| Neon PostgreSQL | Medium | Low | Standard PostgreSQL wire protocol; migrate to RDS with `pg_dump` |
| Clerk | High | Medium | Auth data exportable; SCIM provisioning |
| Cloudflare R2 | High | Low | S3-compatible API; `rclone` sync to S3 |
| Trigger.dev | Medium | Medium | Jobs are plain TypeScript; extractable to BullMQ workers |
| Typesense | Medium | Low | Search index rebuildable from DB; swap to Meilisearch |
| Ably (Realtime) | High | Low | WebSocket protocol; swap to Soketi or Pusher |

---

---

## 13. Database Migration Strategy

### 13.1 Schema Mapping (SQLite → PostgreSQL)

The v1.x SQLite schema maps directly to PostgreSQL with the following changes:

| v1.x (SQLite) | v2.x (PostgreSQL) | Change |
|--------------|-------------------|--------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `UUID DEFAULT gen_random_uuid()` | UUIDs for distributed safety |
| `TEXT` for JSON fields | `JSONB` | Native JSON indexing in PostgreSQL |
| Single database file | `tenant_{uuid}` schema | Multi-tenancy |
| `past_medical_history TEXT` | `past_medical_history JSONB` | Structured querying |
| No `custom_fields` column | `custom_fields JSONB NOT NULL DEFAULT '{}'` | Added to all entities |
| `branch_id INTEGER DEFAULT 1` | `branch_id UUID NOT NULL` | Branches are first-class |
| `doctor_id` not present | `doctor_id UUID` added to appointments | Multi-doctor |

### 13.2 Migration CLI Tool

A Node.js CLI (`vorsa-migrate`) is shipped as part of the platform:

```bash
# Export from Electron app
vorsa-migrate export --input /path/to/clinic.db --output clinic_export.vorsa

# Import to cloud tenant
vorsa-migrate import --file clinic_export.vorsa --tenant-id abc123 --api-key ...

# Dry run (validation only)
vorsa-migrate import --file clinic_export.vorsa --dry-run
```

The tool:
1. Opens the SQLite database
2. Validates schema version compatibility
3. Transforms IDs from integer sequences to deterministic UUIDs (seeded by old ID to ensure repeatability)
4. Copies all images to a temp S3 upload bucket
5. Imports all records in dependency order (patients before appointments, appointments before invoices)
6. Reports: total records imported, skipped, and any validation failures
7. Is idempotent — running twice does not create duplicates

### 13.3 Zero-Downtime Strategy for v1.x Customers

- The Electron app and the SaaS account are independent; the clinic uses both in parallel during a transition period
- A "sync mode" option (Phase 3) lets the Electron app push new records to the cloud in real-time for a smooth handover period
- The clinic officially migrates when they are satisfied; the Electron app enters read-only mode

---

## 14. API Design & Integration Layer

### 14.1 Public REST API (Phase 3, Enterprise Plan)

Base URL: `https://api.vorsa.io/v1`

Authentication: Bearer token (API key generated in tenant Settings)

| Resource | Endpoints |
|----------|-----------|
| Patients | `GET /patients`, `POST /patients`, `GET /patients/{id}`, `PATCH /patients/{id}` |
| Appointments | `GET /appointments`, `POST /appointments`, `PATCH /appointments/{id}` |
| Invoices | `GET /invoices`, `POST /invoices`, `GET /invoices/{id}` |
| Treatments | `GET /treatments`, `POST /treatments` |
| Inventory | `GET /inventory`, `POST /inventory/transactions` |
| Branches | `GET /branches` |
| Doctors | `GET /doctors` |

All responses: `{ data: {...}, meta: { tenant_id, timestamp, version } }`

### 14.2 Webhooks

Tenants configure webhook endpoints to receive real-time events:

| Event | Trigger |
|-------|---------|
| `appointment.created` | New appointment booked |
| `appointment.status_changed` | Status changes (confirmed, completed, etc.) |
| `invoice.paid` | Invoice fully paid |
| `patient.created` | New patient registered |
| `inventory.low_stock` | Item drops below minimum level |

Payload: JSON with event type, timestamp, tenant_id, and full resource object. Retried with exponential backoff on failure (up to 72 hours).

---

## 15. DevOps, CI/CD & Observability

### 15.1 Environments

| Environment | Purpose | Update Trigger |
|-------------|---------|---------------|
| Local | Developer machines | Manual |
| CI | Automated testing | Every PR |
| Staging | Pre-production QA | Merge to `main` |
| Production | Live tenants | Manual promote from staging |

### 15.2 CI/CD Pipeline (GitHub Actions)

```
PR opened
  └─► Lint + Type Check
        └─► Unit Tests (Vitest)
              └─► Integration Tests (Supertest on test DB)
                    └─► Build Docker image
                          └─► Deploy to staging (ECS Fargate)
                                └─► E2E Tests (Playwright on staging)
                                      └─► Approval gate (manual)
                                            └─► Deploy to production (blue-green)
```

### 15.3 Observability

| Tool | What It Monitors |
|------|-----------------|
| Datadog APM | API response times, DB query latency, error rates |
| Datadog Logs | Structured application and audit logs |
| Datadog Infra | ECS CPU/memory, RDS connections, Redis memory |
| Sentry | Frontend JS errors and backend exceptions |
| Uptime Robot | Public health check endpoint, SLA monitoring |
| PagerDuty | On-call alerting for P1/P2 incidents |

### 15.4 Backup Strategy

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| PostgreSQL (RDS) | Continuous | 35 days PITR | AWS automated backups |
| S3 patient images | Versioning enabled | Indefinite | S3 Object Versioning |
| Full tenant export | Weekly | 90 days | BullMQ worker → S3 |
| Tenant self-export | On demand | 7 days (download link) | API-triggered |

---

## 16. SaaS Business Model

### 16.1 Pricing (Indicative)

| Plan | Monthly Price (per clinic) | Annual Price |
|------|--------------------------|-------------|
| Starter | $49 / ₹3,999 | $470 / ₹38,390 (-20%) |
| Business | $129 / ₹9,999 | $1,238 / ₹95,990 (-20%) |
| Enterprise | Custom | Custom |

*Pricing adapts by region. India pricing in INR. Middle East pricing in USD. EU pricing in EUR.*

### 16.2 Revenue Levers

- Monthly subscription (primary)
- Annual subscription discount (reduces churn, improves cash flow)
- Module add-ons (Inventory on Starter, Analytics for Starter/Business upgrade)
- Data migration service (one-time fee for assisted migration from other systems)
- Onboarding packages (premium onboarding + training for enterprise)
- API usage overage (>10,000 calls/month)

### 16.3 Growth Strategy

1. **Existing VORSA Electron users** — zero-friction migration path; they are the first cohort
2. **Dental distributor partnerships** — partner with dental supply companies in India, UAE, and SEA who already sell to clinics
3. **Dental association listings** — register in directories for IDA (India), ADA (US), BDA (UK)
4. **Content marketing** — blog targeting "dental clinic management software" in key markets
5. **Referral programme** — clinics that refer other clinics get one month free

---

## 17. Rollout & Go-To-Market Plan

### Timeline Summary

| Milestone | Target Date |
|-----------|------------|
| Phase 1 complete — private beta | Month 4 |
| Phase 2 complete — public beta | Month 8 |
| GA launch — Starter + Business plans | Month 10 |
| Enterprise plan launch | Month 12 |
| Phase 3 complete — AI + integrations | Month 16 |
| Multi-region fully live | Month 18 |

### Beta Programme

- 5 hand-picked clinics in Phase 1 (existing VORSA users preferred)
- 50 clinics in Phase 2 public beta (mix of markets: India, UAE, SEA, EU)
- Beta users get: 6 months free, white-glove onboarding, monthly feedback calls
- In exchange: usage data, bug reports, testimonials

---

## 18. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Data breach / patient data exposure | Low | Critical | AES-256 at rest, TLS in transit, penetration testing, WAF |
| Tenant data cross-contamination | Low | Critical | Schema isolation, middleware enforcement, automated isolation tests |
| Electron → SaaS migration data loss | Medium | High | Dry-run mode, checksum validation, pre-migration backup |
| GDPR/HIPAA non-compliance | Medium | High | Engage compliance counsel in Phase 2; GDPR-first data model |
| PostgreSQL performance at scale | Medium | Medium | Read replicas, connection pooling (PgBouncer), query optimisation, caching |
| Key developer departure | Medium | Medium | Pair programming, documentation, IaC ensures no single points of failure |
| SaaS pricing too high for target markets | Medium | High | Regional pricing, annual discount, freemium tier consideration in Phase 3 |
| Feature creep delaying Phase 1 | High | Medium | Strict Phase 1 scope: port existing features only, no new features |
| Internet connectivity issues at clinic | Medium | Medium | PWA offline fallback in Phase 3; design for eventual consistency |

---

## 19. Glossary

| Term | Definition |
|------|------------|
| Tenant | A single clinic business entity (may have multiple branches) registered on VORSA SaaS |
| Tenant ID | UUID uniquely identifying a tenant across all VORSA infrastructure |
| Schema-per-tenant | PostgreSQL isolation model where each tenant's tables live in a dedicated schema |
| Strangler Fig | Migration pattern where new system is built alongside old; old system gradually replaced |
| FDI | Fédération Dentaire Internationale — international tooth numbering standard |
| CDT Codes | Current Dental Terminology — ADA's procedure code system used in the US |
| PITR | Point-In-Time Recovery — RDS feature allowing database restore to any second in the retention window |
| tRPC | TypeScript Remote Procedure Call — type-safe API layer without code generation |
| BullMQ | Redis-backed job queue for Node.js background workers |
| PgBouncer | PostgreSQL connection pooler that reduces DB connection overhead at scale |
| RBAC | Role-Based Access Control — permission system based on user roles |
| OIDC | OpenID Connect — authentication layer on top of OAuth 2.0 |
| BAA | Business Associate Agreement — HIPAA requirement between a covered entity and a service provider |
| PWA | Progressive Web Application — web app with offline capabilities via service workers |
| IaC | Infrastructure as Code — managing cloud infrastructure through Terraform scripts |

---

*End of Document*

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-24 | — | Initial VORSA SaaS PRD — cloud migration from Electron v1.x |
| 1.1 | 2026-05-25 | — | Complete tech stack overhaul (§12): Hono, Drizzle, Neon, Cloudflare R2, Trigger.dev, Typesense, Upstash, Resend, Ably, Turborepo monorepo; architecture diagram updated; lock-in assessment added |
