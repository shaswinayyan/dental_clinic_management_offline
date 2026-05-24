# Product Requirements Document (PRD)
## Clinic Management Software — Dental Practice Edition

---

**Document Version:** 1.1  
**Status:** Draft  
**Prepared For:** Internal Development Team  
**Classification:** Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Scope & Constraints](#3-scope--constraints)
4. [User Personas](#4-user-personas)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Module 1 — Patient Management](#6-module-1--patient-management)
7. [Module 2 — Appointment Scheduling](#7-module-2--appointment-scheduling)
8. [Module 3 — Payment & Billing](#8-module-3--payment--billing)
9. [Module 4 — Inventory Management](#9-module-4--inventory-management)
10. [Security & Data Privacy](#10-security--data-privacy)
11. [Backup & Data Portability](#11-backup--data-portability)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [UI/UX Design Principles](#13-uiux-design-principles)
14. [Documentation Requirements](#14-documentation-requirements)
15. [Recommended Tech Stack](#15-recommended-tech-stack)
16. [Database Schema Overview](#16-database-schema-overview)
17. [Future Roadmap](#17-future-roadmap)
18. [Glossary](#18-glossary)

---

## 1. Executive Summary

This document defines the full product requirements for an **on-premise, offline-first Clinic Management Software** tailored for a dental practice. The system covers three core operational areas: Appointment Scheduling, Patient Management, and Payment & Billing. It is designed to run entirely on local hardware with no dependency on the internet or cloud services, ensuring data sovereignty, low latency, and operational continuity even without network access.

The software must meet the quality standards of enterprise-grade ERP systems and healthcare management platforms, with a mature, intuitive UI suitable for clinical staff with minimal technical training.

---

## 2. Product Vision & Goals

### Vision
To provide a self-contained, secure, and highly usable clinic management platform that empowers dental practitioners and their staff to manage patient care, scheduling, and finances efficiently — entirely within their own infrastructure.

### Primary Goals

| # | Goal | Priority |
|---|------|----------|
| G1 | Fully offline, on-premise operation with no external dependencies | Critical |
| G2 | Secure, user-controlled data storage with transparent file locations | Critical |
| G3 | Comprehensive patient lifecycle management including clinical records | High |
| G4 | Visual, interactive dental charting per patient | High |
| G5 | Flexible multi-chair appointment scheduling with status workflows | High |
| G6 | Complete billing, invoicing, and ledger management | High |
| G7 | Role-based access for Doctor and Receptionist | High |
| G8 | User-initiated backup and restore with clear storage paths | High |
| G9 | Chronological procedure & image timeline per patient for quick doctor review | High |
| G10 | Inventory management with stock tracking, low-stock alerts, and branch-level visibility | High |
| G11 | Detailed user and developer documentation | Medium |

---

## 3. Scope & Constraints

### 3.1 In Scope (v1.0)

- Single-clinic, single-location deployment
- Two user roles: Doctor and Receptionist
- Three operational chairs (Chair 1, Chair 2, Chair 3) — each with independent scheduling logic
- Patient registration, clinical records, treatment history, and dental charting
- Invoice generation, partial payment handling, multi-method payment tracking, and ledger
- Full backup and restore with user-defined storage path
- Offline-first: zero internet or cloud connectivity required
- Procedure & image timeline view per patient
- Inventory management with branch-level stock tracking, low-stock alerts, and consumption logging
- Comprehensive user manual and developer documentation

### 3.2 Out of Scope (v1.0)

- Multi-clinic support (planned for v2.0)
- Cloud / SaaS migration (planned for v2.0)
- Patient-facing portal or mobile application
- Automated SMS/email reminders
- Third-party integrations (insurance, pharmacy, lab)
- Multi-doctor scheduling within the same clinic

### 3.3 Constraints

- **Connectivity:** No internet connectivity required or permitted for core functionality
- **Platform:** Runs on a Windows 10/11 desktop or server; optionally Linux
- **Data:** All data stored locally; user decides the storage path
- **Compliance:** Must align with coding standards of healthcare ERP systems and general data security best practices (data encryption at rest, access control)

---

## 4. User Personas

### 4.1 The Doctor

**Role:** Primary clinical user and system owner  
**Technical Proficiency:** Low to moderate  
**Primary Tasks:**
- Review daily appointment schedule
- Record clinical assessments, procedures, and dental chart annotations
- Review patient history and prescribed medications
- Mark appointments as completed

**Key Needs:**
- Quick access to patient clinical records
- Interactive dental chart to annotate per-tooth procedures
- Clean view of all scheduled appointments for the day

---

### 4.2 The Receptionist

**Role:** Administrative operator  
**Technical Proficiency:** Low to moderate  
**Primary Tasks:**
- Register new patients
- Schedule, reschedule, and manage appointments across all chairs
- Process payments and generate invoices
- Confirm appointments via phone call and update status
- Manage the payment ledger

**Key Needs:**
- Intuitive calendar-based scheduling interface
- Inline appointment status management (Pending → Confirmed → Completed)
- Clear billing and partial payment tracking dashboard

---

## 5. System Architecture Overview

### 5.1 Deployment Model

```
┌──────────────────────────────────────────────────────┐
│                  On-Premise Machine                  │
│                                                      │
│   ┌─────────────┐        ┌──────────────────────┐   │
│   │  Frontend   │◄──────►│  Backend Application │   │
│   │  (Desktop   │        │  Server (Local)       │   │
│   │   or Web)   │        └──────────┬───────────┘   │
│   └─────────────┘                   │               │
│                              ┌──────▼──────┐        │
│                              │  Local DB   │        │
│                              │  (SQLite /  │        │
│                              │  PostgreSQL)│        │
│                              └─────────────┘        │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │         Backup Storage (User-Defined Path)   │  │
│   └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 5.2 High-Level Component Map

| Component | Description |
|-----------|-------------|
| Frontend UI | Desktop application (Electron) or local web app |
| API Layer | RESTful local server handling all business logic |
| Database | Relational database stored on local disk |
| Auth Module | Role-based authentication (Doctor / Receptionist) |
| Backup Engine | Scheduled and manual backup with user-configured path |
| Document Generator | PDF invoice generator (offline, no cloud dependency) |
| Image Store | Local file system storage for procedure images |

---

## 6. Module 1 — Patient Management

### 6.1 Patient Registration

Every patient is assigned a unique **OP ID** (Outpatient ID) automatically upon registration.

#### Required Fields

| Field | Type | Validation |
|-------|------|------------|
| OP ID | Auto-generated | Read-only, system-assigned, sequential |
| Full Name | Text | Required, max 150 chars |
| Contact Number | Phone | Required, numeric, 10 digits |
| Address | Text Area | Optional, max 500 chars |
| Date of Birth | Date | Optional |
| Gender | Dropdown | Optional |
| Blood Group | Dropdown | Optional |
| Emergency Contact | Phone | Optional |

#### Business Rules

- OP ID format: `OP-YYYYMMDD-XXXX` (date-based sequential number)
- Duplicate contact number detection with soft warning (not a hard block, since family members may share)
- Patient records cannot be permanently deleted; they can be archived

---

### 6.2 Patient Detail View

The patient detail page is a tabbed interface presenting all information about a single patient in one unified view.

#### Tab Structure

```
┌──────────────────────────────────────────────────────────────┐
│  [ General Info ] [ Treatments ] [ Billing ] [ Images ]      │
│  [ Appointments ] [ Clinical Assessment ] [ Dental Chart ]   │
│  [ Treatment Timeline ] [ Allergies ] [ Medications ]        │
└──────────────────────────────────────────────────────────────┘
```

---

### 6.3 General Information Tab

Displays and allows editing of all registration fields listed in Section 6.1. Includes a section for **Past Medical History** as a free-text or structured note field.

**Past Medical History Fields:**

- Systemic conditions (e.g., Diabetes, Hypertension, Cardiac issues)
- Surgical history
- Free-text notes field for other conditions

---

### 6.4 Treatments Tab

A chronological log of all procedures performed on the patient.

| Column | Description |
|--------|-------------|
| Date | Date of treatment |
| Tooth / Area | Tooth number or mouth area |
| Procedure | Procedure name (from a predefined list) |
| Chair | Which chair the procedure was done at |
| Doctor | Treating doctor |
| Status | Completed / Ongoing / Planned |
| Notes | Free-text clinical note for that session |

---

### 6.5 Billing Tab (within Patient Record)

A summarized view of all financial transactions linked to this patient:

- Total billed amount
- Total paid amount
- Outstanding balance
- List of individual invoices with drill-down
- Quick link to create a new invoice

---

### 6.6 Images Tab

A structured gallery of all clinical images associated with the patient, organized to support clinical review.

#### Image Upload
- Accepts: JPG, PNG, BMP, TIFF (X-rays, intraoral photos, before/after, diagnostic scans)
- Each uploaded image is tagged with:
  - Date of capture
  - Procedure Name (linked from treatment catalogue)
  - Tooth / Area (FDI notation or free text)
  - Image Type: X-Ray / Intraoral Photo / Before / After / Other
  - Optional notes

#### Storage
- Images stored on local filesystem: `/data/patients/{OP-ID}/images/`
- File naming convention: `{OP-ID}_{YYYYMMDD}_{procedure}_{tooth}_{seq}.ext`
- Thumbnails auto-generated and cached for gallery view

#### Gallery Layout
- Thumbnails arranged in a responsive grid grouped by procedure session date
- Click to open full-resolution lightbox with pan/zoom
- Side-by-side comparison mode: select any two images to view them next to each other (useful for before/after assessment)
- Images can be linked to a specific dental chart tooth entry

---

### 6.7 Appointment History Tab

A read-only log of all past and upcoming appointments for the patient:

- Date and time
- Chair
- Treatment type
- Appointment status
- Cancellation/rescheduling notes if any

---

### 6.8 Clinical Assessment Tab

A free-text and structured notes section per procedure session:

- Subjective notes (patient-reported symptoms)
- Objective observations (clinical findings)
- Assessment (diagnosis)
- Plan (treatment plan for next visit)
- Follows SOAP (Subjective, Objective, Assessment, Plan) format optionally

---

### 6.9 Interactive Dental Chart

This is the most complex and clinically critical feature of the patient module.

#### 6.9.1 Chart Display

- Full FDI (Fédération Dentaire Internationale) notation system: 32 permanent teeth + 20 primary teeth
- Visual diagram of upper and lower arch, divided into quadrants (Q1–Q4)
- Each tooth is rendered as a clickable SVG icon showing the five surfaces: Mesial, Distal, Buccal/Labial, Lingual/Palatal, Occlusal/Incisal

#### 6.9.2 Per-Tooth Interaction

Clicking any tooth opens a detail panel:

- **Tooth Number** (FDI notation)
- **Procedure History**: List of all procedures done on this tooth with dates
- **Planned Procedures**: Upcoming treatments scheduled for this tooth
- **Comments**: Free-text annotation field (supports timestamped notes by Doctor)
- **Status Tags**: Color-coded per procedure type (see below)

#### 6.9.3 Color Coding by Procedure

| Color | Procedure Type |
|-------|---------------|
| Blue | Filling |
| Red | Extraction |
| Yellow | Crown / Bridge |
| Green | Completed/Healthy |
| Orange | Root Canal Treatment (RCT) |
| Purple | Implant |
| Grey | Planned (not yet done) |
| White | Untreated / No record |

- Color coding is applied per surface for filling procedures
- Multiple overlapping procedures handled by showing procedure list on hover/click

#### 6.9.4 Legend & Controls

- Visible color legend on the chart page
- Toggle between adult and pediatric dentition view
- Print/export chart as PDF for patient records

---

### 6.10 Treatment Timeline Tab

The Treatment Timeline is a **chronological, visual record** of all procedures and associated images for the patient — purpose-built so the Doctor can scan the full clinical history at a glance before or during a consultation.

#### 6.10.1 Layout

The timeline is a vertical scroll view with entries ordered newest-first (reversible to oldest-first). Each entry represents one procedure session.

```
┌─────────────────────────────────────────────────────────────────┐
│  ● 12 Jan 2026 — Root Canal Treatment — Tooth 46               │
│    Chair 2  |  Dr. —  |  ✔ Completed                           │
│    ┌──────┐ ┌──────┐                                            │
│    │ img1 │ │ img2 │   "Patient reported mild pain post RCT.    │
│    └──────┘ └──────┘    Prescribed Ibuprofen 400mg."            │
│─────────────────────────────────────────────────────────────────│
│  ● 20 Nov 2025 — Scaling & Polishing — Full Mouth              │
│    Chair 1  |  Dr. —  |  ✔ Completed                           │
│    ┌──────┐                                                      │
│    │ img1 │   "Moderate calculus deposits. Reviewed brushing."  │
│    └──────┘                                                      │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.10.2 Per-Entry Content

Each timeline card contains:

| Element | Description |
|---------|-------------|
| Date | Date of the session |
| Procedure Name | From treatment catalogue |
| Tooth / Area | FDI tooth number or mouth region |
| Chair | Which chair was used |
| Status | Completed / Ongoing / Planned |
| Clinical Note | Summary from Clinical Assessment (SOAP) for that session |
| Images | Thumbnail strip of all images tagged to this procedure session; click to expand |
| Linked Invoice | Badge showing billed amount for that session; click to open invoice |

#### 6.10.3 Interaction

- **Expand/Collapse**: Each card is collapsible; collapsed state shows only date, procedure, and tooth
- **Image Preview**: Clicking any thumbnail opens the full-resolution lightbox with the same comparison mode available in the Images Tab
- **Filter Bar** at the top of the timeline:
  - Filter by tooth number
  - Filter by procedure type
  - Filter by date range
  - Filter by status (Completed / Planned)
- **Print / Export**: Export the full timeline as a PDF clinical summary report, optionally including images

#### 6.10.4 Planned Procedures in Timeline

Future/planned procedures appear at the top of the timeline in a distinct **Upcoming** section, visually differentiated with a dashed border and a calendar icon, so the Doctor can immediately see what is scheduled next.

---

### 6.11 Allergies Tab

| Field | Type |
|-------|------|
| Allergen Name | Text |
| Allergy Type | Dropdown (Drug / Food / Material / Other) |
| Severity | Dropdown (Mild / Moderate / Severe) |
| Reaction Description | Text area |
| Date Noted | Date |

- A prominent allergy alert banner appears at the top of the patient record if any allergies are logged
- Alert appears in the appointment view when that patient is scheduled

---

### 6.12 Medications Tab

Log of previously prescribed medications:

| Field | Type |
|-------|------|
| Medication Name | Text |
| Dosage | Text |
| Frequency | Text |
| Duration | Text |
| Prescribed By | Text |
| Prescribed On | Date |
| Reason | Text area |
| Status | Active / Completed / Discontinued |

---

## 7. Module 2 — Appointment Scheduling

### 7.1 Chair Configuration

The clinic operates three chairs with different scheduling logic:

| Chair | Type | Default Slot Duration | Notes |
|-------|------|-----------------------|-------|
| Chair 1 (OP1) | General / Major Procedures | 60 minutes | Long-duration treatments |
| Chair 2 (OP2) | Minor / Short Procedures | 15–30 minutes | Quick procedures |
| Chair 3 (OP3) | Minor / Short Procedures | 15–30 minutes | Quick procedures |

- Slot duration is configurable per chair by the admin
- Chairs operate independently; booking one chair does not affect others

---

### 7.2 Scheduling Interface

#### 7.2.1 Daily Scheduler View

- Default view: Current day across all three chairs side by side
- Each chair is displayed as a vertical timeline with colored slot blocks
- The user can switch between Day View, Week View, and Monthly Summary
- Color coding per appointment status:

| Color | Status |
|-------|--------|
| Light Blue | Scheduled / Unconfirmed |
| Green | Confirmed |
| Orange | Pending (requires follow-up) |
| Grey | Completed |
| Red | Cancelled |

#### 7.2.2 Creating an Appointment

1. User clicks an empty time slot on any chair timeline
2. A modal form opens:
   - **Patient Search**: Search by OP ID, Name, or Phone Number; option to register new patient inline
   - **Treatment Selection**: Dropdown of treatments available for that chair type
   - **Date & Time**: Pre-filled from the slot clicked; editable
   - **Duration**: Auto-filled based on treatment; overridable
   - **Notes**: Optional field for pre-appointment notes
3. On save, the slot is blocked on the calendar and the appointment is created with status **Scheduled**

#### 7.2.3 Treatment Catalogue

A configurable list of treatments per chair type:

- Each treatment has a Name, Default Duration, and Default Price
- Admin can add/edit/deactivate treatments from the Settings module
- Treatments are categorized (e.g., Preventive, Restorative, Surgical, Orthodontic)

---

### 7.3 Appointment Status Workflow

```
[Scheduled] ──► [Confirmed] ──► [Completed]
     │               │
     ▼               ▼
 [Pending]       [Cancelled]
     │
     ▼
 [Rescheduled] ──► (New appointment created, original marked Rescheduled)
```

#### Status Definitions

| Status | Description | Who Can Set |
|--------|-------------|-------------|
| Scheduled | Appointment booked, not yet confirmed | System (auto) |
| Confirmed | Verbally confirmed with patient via phone | Receptionist |
| Pending | Called but no answer; needs follow-up | Receptionist |
| Completed | Procedure done | Doctor / Receptionist |
| Cancelled | Appointment cancelled | Receptionist |
| Rescheduled | Moved to a new date/time | Receptionist |

---

### 7.4 All Appointments List View

A dedicated page showing all appointments across all chairs:

#### Filters Available

- Date range
- Chair (All / Chair 1 / Chair 2 / Chair 3)
- Status
- Patient name or OP ID
- Treatment type

#### Columns in the List

| Column | Description |
|--------|-------------|
| Date & Time | Appointment timestamp |
| Patient Name | Linked to patient record |
| OP ID | Patient identifier |
| Chair | Which chair |
| Treatment | Procedure name |
| Status | Color-coded badge |
| Actions | Confirm / Reschedule / Mark Pending / Mark Completed / Cancel |

#### Inline Actions

- Status changes are made directly from the list without navigating away
- Rescheduling opens a date/time picker; the original slot is freed and a new one is created
- Completed appointments are locked for editing; only notes can be appended

---

### 7.5 Appointment Conflict & Validation Rules

- Two appointments cannot occupy the same chair at the same time
- Warning shown if the same patient has another appointment within 30 minutes on a different chair
- Past time slots cannot be booked; past appointments remain read-only
- Minimum booking advance: configurable (default: 0 minutes — same-day walk-ins allowed)

---

## 8. Module 3 — Payment & Billing

### 8.1 Invoice Generation

An invoice is generated after a procedure is completed (or initiated mid-treatment for partial billing).

#### Invoice Fields

| Field | Description |
|-------|-------------|
| Invoice Number | Auto-generated, sequential |
| Patient Name & OP ID | Linked from patient record |
| Date of Service | Date of the appointment |
| Procedure(s) | List of procedures with unit price |
| Subtotal | Sum of all procedures |
| Discount | Optional flat or percentage discount |
| Tax | Configurable GST/tax rate (can be 0%) |
| Total Amount | Final payable amount |
| Amount Paid | Payment collected so far |
| Balance Due | Outstanding amount |
| Payment Method | Cash / UPI / Card / Multiple |
| Status | Paid / Partially Paid / Unpaid |

#### Invoice Behaviour

- One invoice can contain multiple procedures from the same visit
- Partial payments are tracked against the invoice
- Invoice can be printed or exported as PDF (offline, no cloud)
- Invoice number format: `INV-YYYYMMDD-XXXX`

---

### 8.2 Partial Payment Handling

When a patient makes multiple payments toward a single invoice:

- Each payment is recorded as a **Payment Entry** with: Amount, Date, Method (Cash/UPI/Card), Reference/Note
- The invoice status automatically updates:
  - 0% paid → **Unpaid**
  - 1–99% paid → **Partially Paid**
  - 100% paid → **Paid**
- The outstanding balance is visible at all times

---

### 8.3 Consolidated Invoice View

A report view that aggregates billing data:

#### Filters

- Date range
- Patient (optional)
- Payment method (Cash / UPI / Card / All)
- Invoice status (Paid / Partial / Unpaid)

#### Output

- Tabular list of invoices matching filters
- Summary totals: Total Billed, Total Collected (Cash), Total Collected (UPI), Total Collected (Card), Total Outstanding
- Export to PDF or CSV

---

### 8.4 Payment Ledger

A dedicated ledger module for the receptionist to manually verify and mark payments:

#### Ledger Entry Fields

| Field | Description |
|-------|-------------|
| Date | Payment date |
| Patient Name | Linked patient |
| Invoice Number | Linked invoice |
| Amount | Payment amount |
| Payment Method | Cash / UPI / Card |
| UPI Reference / Card Last 4 | Reference for non-cash payments |
| Verified | Checkbox (manually marked by staff) |
| Verified By | User who marked it verified |
| Notes | Optional remarks |

#### Ledger Features

- Filter by date, method, or verification status
- Daily totals per payment method shown at the bottom
- A "Mark All Verified for Today" quick action
- Export ledger entries as PDF or CSV for daily reconciliation
- Unverified entries highlighted visually

---

### 8.5 Billing Rules

- Prices are pulled from the Treatment Catalogue but can be overridden at invoice creation
- Discounts require a reason note
- Invoices cannot be deleted once created; they can be voided (voided reason required)
- Only the Doctor or Senior Receptionist can apply discounts above a configurable threshold (e.g., >20%)

---

## 9. Module 4 — Inventory Management

Inventory Management tracks all dental consumables, materials, equipment, and medicines used across the clinic. In v1.0 it manages a single clinic's stock; the schema is designed to extend to multiple branches in v2.0 with no structural changes.

---

### 9.1 Inventory Item Catalogue

Every stocked item is registered in a central catalogue before it can be used in stock transactions.

#### Item Fields

| Field | Type | Description |
|-------|------|-------------|
| Item ID | Auto-generated | Unique identifier |
| Item Name | Text | e.g., "Composite Resin A2 Shade" |
| Category | Dropdown | Consumable / Material / Equipment / Medicine / PPE |
| Unit of Measure | Dropdown | Piece / Box / Bottle / Pack / ml / g |
| Minimum Stock Level | Number | Threshold below which a low-stock alert fires |
| Reorder Quantity | Number | Suggested quantity to reorder |
| Current Stock | Number | Computed from all stock-in minus stock-out entries |
| Unit Cost | Currency | Average purchase cost per unit |
| Storage Location | Text | Shelf/cabinet reference within the clinic |
| Supplier Name | Text | Primary supplier |
| Notes | Text area | Storage requirements, handling notes |
| Is Active | Boolean | Inactive items are hidden from daily workflows |

#### Item Categories (Predefined, Extensible)

- **Consumables**: Gloves, masks, cotton rolls, disposable saliva ejectors, needles
- **Materials**: Composite resin, glass ionomer, impression material, cements, bonding agents
- **Instruments**: Burs, files, probes (reusable; tracked by unit count)
- **Medicines**: Local anaesthetics, antibiotics, analgesics
- **PPE**: Face shields, gowns, surgical caps
- **Equipment**: Autoclave pouches, sterilisation cassettes

---

### 9.2 Stock Transactions

All changes to inventory are recorded as explicit transactions — no direct quantity edits.

#### Transaction Types

| Type | Description | Triggered By |
|------|-------------|--------------|
| Stock In (Purchase) | New stock received from supplier | Manual entry by Receptionist/Doctor |
| Stock In (Return) | Unused items returned to stock | Manual entry |
| Stock Out (Procedure Use) | Items consumed during a patient procedure | Linked to appointment or manual |
| Stock Out (Wastage) | Expired or damaged items written off | Manual entry with reason |
| Stock Out (Transfer) | Items moved to another branch (v2.0) | Manual entry |
| Adjustment | Stock count correction after physical audit | Doctor role only; requires reason |

#### Stock In Entry Fields

| Field | Description |
|-------|-------------|
| Item | Select from catalogue |
| Quantity | Number received |
| Unit Cost | Cost per unit for this batch |
| Batch / Lot Number | Optional, for medicines and materials |
| Expiry Date | Optional, for medicines and consumables |
| Supplier | Pre-filled from catalogue; overridable |
| Invoice / Receipt Number | Supplier reference |
| Date Received | Date |
| Received By | User |
| Notes | Optional |

#### Stock Out Entry Fields

| Field | Description |
|-------|-------------|
| Item | Select from catalogue |
| Quantity | Number consumed/removed |
| Reason Type | Procedure Use / Wastage / Adjustment |
| Linked Appointment | Optional; links consumption to a patient procedure |
| Date | Date of consumption |
| Recorded By | User |
| Notes | Optional |

---

### 9.3 Inventory Dashboard

The main inventory view provides a real-time snapshot of stock levels.

#### Dashboard Panels

| Panel | Content |
|-------|---------|
| Low Stock Alerts | Items at or below minimum stock level; highlighted in red/amber |
| Expiring Soon | Items with expiry date within 30 days (configurable) |
| Recent Activity | Last 10 stock transactions |
| Total Item Count | Number of active catalogue items |
| Category Breakdown | Bar chart of stock value by category |

#### Stock List View

A filterable, sortable table of all inventory items:

| Column | Description |
|--------|-------------|
| Item Name | Linked to item detail |
| Category | Category badge |
| Current Stock | Number with unit label |
| Min Level | Threshold value |
| Status | In Stock / Low Stock / Out of Stock |
| Last Updated | Date of most recent transaction |
| Actions | Add Stock / Record Usage / View History |

Filters: Category, Status (In Stock / Low / Out), Search by name.

---

### 9.4 Item Detail & Transaction History

Clicking any item opens a detail page with:

- Full item metadata (editable by Doctor)
- **Stock History**: Chronological log of all transactions for this item
  - Date, Transaction Type, Quantity (+/-), Running Balance, User, Notes
- **Expiry Tracker**: List of batches with expiry dates and remaining quantities
- **Usage Analytics**: Monthly consumption chart (bar chart by month) so the Doctor can spot usage trends and plan reorders

---

### 9.5 Low Stock & Expiry Alerts

- A persistent **alert badge** on the Inventory sidebar icon shows the count of items needing attention
- On application startup, a dismissible notification lists:
  - Items currently out of stock
  - Items below minimum level
  - Items expiring within the configured alert window (default: 30 days)
- Alerts are also visible in the Inventory Dashboard
- No email/SMS (offline system); alerts are in-app only

---

### 9.6 Procedure-Linked Consumption (Optional Workflow)

When a Doctor completes an appointment, the system optionally prompts to log materials used:

1. After marking an appointment as Completed, a **"Log Materials Used"** button appears
2. The user selects items from the catalogue and enters quantities consumed
3. These are saved as Stock Out (Procedure Use) transactions linked to the appointment
4. This enables per-procedure material cost tracking in future reporting

This step is optional — if skipped, inventory must be updated manually via the Inventory module.

---

### 9.7 Inventory Reports

| Report | Description |
|--------|-------------|
| Current Stock Report | Full catalogue with current quantities and status; exportable as PDF/CSV |
| Consumption Report | Items used within a date range, optionally filtered by procedure or category |
| Purchase History | All Stock In transactions within a date range |
| Wastage Report | All wastage/write-off entries with reasons |
| Expiry Report | All items with expiry dates, sorted by nearest expiry |
| Low Stock Report | All items currently at or below minimum level |

All reports exportable as PDF or CSV.

---

### 9.8 Branch-Level Inventory (v1.0 Foundation for v2.0)

In v1.0, all inventory belongs to a single default branch (`branch_id = 1`). The data model includes `branch_id` on all inventory tables from day one so that multi-branch support in v2.0 requires no schema migration — only UI additions.

In v2.0, the following will be unlocked:
- Each branch has its own stock levels and transaction history
- Stock Transfer transactions move items between branches
- A consolidated cross-branch stock report for the clinic owner
- Low-stock alerts are shown per branch

---

### 9.9 Access Control for Inventory

| Action | Doctor | Receptionist |
|--------|--------|--------------|
| View inventory dashboard & reports | ✓ | ✓ |
| Add new items to catalogue | ✓ | ✗ |
| Edit item details (min level, cost) | ✓ | ✗ |
| Record stock in (purchases) | ✓ | ✓ |
| Record stock out (usage/wastage) | ✓ | ✓ |
| Perform stock adjustments | ✓ | ✗ |
| Deactivate catalogue items | ✓ | ✗ |

---

## 10. Security & Data Privacy

### 9.1 Authentication

- Login required on application startup
- Two user roles: **Doctor** and **Receptionist**
- Username and hashed password stored in the local database (bcrypt hashing)
- Session timeout after configurable idle period (default: 30 minutes)
- No password recovery via email (offline system); password reset handled by Doctor role

### 9.2 Role-Based Access Control (RBAC)

| Feature | Doctor | Receptionist |
|---------|--------|--------------|
| View patient records | ✓ | ✓ |
| Edit clinical notes & dental chart | ✓ | ✗ |
| Register / edit patients | ✓ | ✓ |
| Schedule appointments | ✓ | ✓ |
| Confirm / complete appointments | ✓ | ✓ |
| Create invoices | ✓ | ✓ |
| Apply large discounts (>threshold) | ✓ | ✗ |
| Void invoices | ✓ | ✗ |
| Mark ledger entries verified | ✓ | ✓ |
| Access backup settings | ✓ | ✗ |
| Change system settings | ✓ | ✗ |
| Manage user accounts | ✓ | ✗ |

### 9.3 Data Encryption

- Database file encrypted at rest using AES-256 (if using SQLite with SQLCipher, or PostgreSQL TDE)
- Procedure images stored in an encrypted folder or within the database as blobs
- Application config file (including DB credentials) protected with OS-level file permissions
- Sensitive logs do not contain patient identifiable information (PII)

### 9.4 Audit Logging

- All data modifications (create, update, delete/void) are logged with: timestamp, user, action, and record reference
- Audit logs are append-only and cannot be edited from within the application
- Doctor can view the audit log from Settings

---

## 11. Backup & Data Portability

### 10.1 Manual Backup

- A **"Backup Now"** button accessible from Settings (Doctor role only)
- User selects the destination folder via a system file picker dialog
- Backup creates a single compressed, encrypted archive file: `clinic_backup_YYYYMMDD_HHMMSS.bak`
- Contents of the backup:
  - Full database dump
  - All patient images
  - Application configuration (excluding credentials)
- After backup completes, a success dialog shows the **full file path** of the backup file

### 10.2 Scheduled Backup

- Option to enable automatic daily backup at a configurable time
- Destination folder is set by the Doctor
- Retains the last N backups (configurable, default: 7)
- A notification/log entry is created after each scheduled backup

### 10.3 Restore

- Restore from backup accessible from Settings
- User browses to a `.bak` file, and the system restores the database and images
- Restore requires confirmation and warns that it will overwrite current data
- A pre-restore backup of current data is automatically taken before restoring

### 10.4 Data Portability

- The Doctor can export the full database as a standard SQL dump at any time
- Individual patient records can be exported as a structured PDF report
- The application clearly documents where the database file is located (shown in Settings → About)

---

## 12. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|--------|--------|
| Application startup time | < 5 seconds on standard hardware |
| Page load (any module) | < 1 second |
| Search results (patient lookup) | < 500ms for up to 10,000 records |
| Invoice generation (PDF) | < 3 seconds |
| Backup (full dataset <5GB) | < 5 minutes |

### 11.2 Reliability

- Application must not crash on unexpected input; all forms use validated inputs
- Database transactions use ACID-compliant operations (no partial writes)
- All destructive actions (delete, void, restore) require a confirmation step

### 11.3 Scalability (within v1.0 scope)

- Designed to handle up to 10,000 patient records without degradation
- Appointment data for 5+ years accessible without full-table scans (proper indexing required)

### 11.4 Compatibility

- Runs on Windows 10/11 (primary target)
- Optional: Linux (Ubuntu 20.04+)
- Minimum hardware: 4 GB RAM, dual-core CPU, 50 GB HDD
- Screen resolution: 1280×800 minimum; 1920×1080 recommended

### 11.5 Maintainability

- Codebase must follow language-specific coding standards (linting enforced)
- Modular architecture: each module (Patient, Appointment, Billing) must be independently testable
- All modules must have unit test coverage ≥ 70%
- Code comments and inline documentation required for all public functions/APIs

---

## 13. UI/UX Design Principles

### 12.1 Design Philosophy

The UI must feel **mature, professional, and clinical** — not consumer-grade or toy-like. It should inspire confidence and reduce cognitive load for clinical staff.

### 12.2 Layout Principles

- Persistent sidebar navigation with module icons and labels
- Top bar showing current user name, role, and date/time
- Breadcrumb navigation for deep pages (e.g., Patient → John Doe → Dental Chart)
- No more than 3 levels of navigation depth

### 12.3 Color System

| Element | Color Guidance |
|---------|---------------|
| Primary Brand | Deep navy blue or teal (professional medical aesthetic) |
| Accent | Muted green or orange for action buttons |
| Danger/Delete | Red, requiring explicit confirmation |
| Success | Green badges |
| Warning / Pending | Amber/orange badges |
| Background | Light grey (#F5F7FA) |
| Cards/Panels | White with subtle shadow |

### 12.4 Accessibility

- Minimum font size: 14px for body text; 12px for secondary labels
- All interactive elements have a minimum touch/click target of 40×40px
- Keyboard navigation support for all major workflows
- Form validation errors shown inline, not as pop-ups

### 12.5 Key UX Rules

- No action should require more than 3 clicks from the main dashboard
- Confirmation dialogs for all destructive or irreversible actions
- Loading states shown for all async operations
- Auto-save for clinical notes (debounced, 30-second intervals)
- Search fields across the app support partial name, OP ID, and phone number lookup

---

## 14. Documentation Requirements

### 13.1 User Manual

To be delivered as a PDF and built into the application's Help section:

**Sections Required:**

1. Getting Started — Installation and first-time setup
2. User Account Setup — Creating Doctor and Receptionist accounts
3. Patient Registration — Step-by-step guide with screenshots
4. Using the Dental Chart — Interactive guide
5. Scheduling Appointments — All scenarios (new, reschedule, cancel)
6. Billing & Invoicing — Creating invoices, recording payments
7. Ledger Management — Daily reconciliation workflow
8. Backup & Restore — How to back up, where files are stored, how to restore
9. Settings & Configuration — Treatments catalogue, slot durations, tax settings
10. Troubleshooting — Common issues and fixes

### 13.2 Developer Documentation

To be delivered as a Markdown-based documentation site (e.g., using MkDocs or Docusaurus) in the repository:

**Sections Required:**

1. Architecture Overview — Component diagram and design decisions
2. Repository Structure — Folder layout explanation
3. Setup for Development — Prerequisites, install steps, environment variables
4. Database Schema — Entity-relationship diagram with table descriptions
5. API Reference — All internal REST endpoints with request/response examples
6. Module Documentation — Patient, Appointment, Billing, Auth, Backup
7. Testing Guide — How to run unit, integration, and E2E tests
8. Build & Packaging — How to produce an installable artifact
9. Code Style Guide — Linting rules, naming conventions, commit message format
10. Contribution Guidelines — PR process, review checklist

---

## 15. Recommended Tech Stack

### 14.1 Option A — Electron Desktop App (Recommended for Simplicity)

Best suited for: Single-machine deployment, non-technical users, Windows primary target.

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Runtime** | Electron (Node.js + Chromium) | Cross-platform desktop app; ships as a single installable |
| **Frontend Framework** | React 18 + TypeScript | Component-based, large ecosystem, type safety |
| **UI Component Library** | Ant Design or MUI (Material UI) | Mature, healthcare-grade components; data tables, modals, forms |
| **State Management** | Zustand or Redux Toolkit | Predictable state for complex multi-module UI |
| **Dental Chart** | Custom SVG + React (D3.js optional) | Full control over tooth-level interactivity and color-coding |
| **Styling** | Tailwind CSS or CSS Modules | Utility-first; consistent design system |
| **Backend (in-process)** | Node.js via Electron main process | Handles DB queries, file I/O, backup — no separate server needed |
| **Database** | SQLite (with better-sqlite3) | File-based, zero-config, ACID-compliant, easy to back up |
| **Encryption** | SQLCipher (SQLite extension) | AES-256 encryption for the database file at rest |
| **PDF Generation** | PDFKit or Puppeteer (local) | Offline invoice and report PDF generation |
| **Image Storage** | Local filesystem (structured folders) | Simple, user-readable, easy to back up |
| **Authentication** | bcrypt + JWT (local session tokens) | Secure local login with hashed passwords |
| **Testing** | Jest + React Testing Library + Playwright | Unit, integration, and E2E tests |
| **Build & Packaging** | Electron Forge / electron-builder | Generates Windows installer (.exe / .msi) |
| **Logging** | Winston | Structured application and audit logging |
| **Validation** | Zod (frontend) + express-validator if REST | Runtime schema validation |

---

### 14.2 Option B — Local Web App + Python Backend (Recommended for Flexibility)

Best suited for: Practices that may want multi-machine (LAN) access in the future without major refactoring.

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend Framework** | React 18 + TypeScript | Same as Option A |
| **UI Component Library** | Ant Design | Best-in-class data grids and form components |
| **Backend Framework** | FastAPI (Python) | High-performance async REST API; excellent documentation tools |
| **ORM** | SQLAlchemy 2.0 + Alembic (migrations) | Mature Python ORM; schema migrations built-in |
| **Database** | PostgreSQL (local) or SQLite | PostgreSQL for multi-user; SQLite for single-user simplicity |
| **Database Encryption** | pgcrypto (PostgreSQL) or SQLCipher | Encryption at the database or column level |
| **Authentication** | FastAPI-Users + JWT | Role-based auth with token refresh |
| **PDF Generation** | ReportLab or WeasyPrint | Fully offline PDF generation in Python |
| **Background Tasks** | APScheduler | Scheduled daily backup automation |
| **Testing** | pytest + Playwright | Backend unit/integration tests + E2E |
| **Packaging** | PyInstaller + Inno Setup | Bundle Python app + React build into Windows installer |
| **Logging** | Python logging + structlog | Structured audit logs |
| **API Docs** | Swagger UI (auto via FastAPI) | Auto-generated developer API documentation |

---

### 14.3 Option C — Full-Stack TypeScript (Monorepo)

Best suited for: Teams with strong TypeScript expertise; easiest for future cloud migration (v2.0).

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 14 (App Router) + TypeScript | Full-stack React; easy to port to cloud later |
| **Backend** | tRPC or NestJS | Type-safe API; shared types between frontend and backend |
| **Database** | PostgreSQL + Prisma ORM | Modern type-safe ORM; Prisma migrations for schema management |
| **Auth** | NextAuth.js or custom JWT | Role-based session handling |
| **Dental Chart** | Custom SVG components | D3.js-driven interactive chart |
| **PDF** | @react-pdf/renderer | React-based PDF generation |
| **Packaging** | Electron Wrapper or Tauri | Desktop packaging for offline deployment |
| **Testing** | Vitest + Playwright | Fast unit + E2E testing |
| **Monorepo** | Turborepo or Nx | Shared packages, build caching |

---

### 14.4 Tech Stack Decision Matrix

| Criteria | Option A (Electron) | Option B (Python) | Option C (TS Monorepo) |
|----------|--------------------|--------------------|------------------------|
| Offline simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Developer familiarity (web devs) | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Future cloud migration ease | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Packaging simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Ecosystem maturity | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Setup complexity | Low | Medium | Medium-High |

**Recommendation:** **Option A (Electron + React + SQLite)** for v1.0 due to ease of distribution, offline-first design, and self-contained packaging. Architect the React frontend as a standalone SPA so it can be decoupled into Option B or C during the v2.0 cloud migration.

---

### 14.5 Common Infrastructure Tools (All Options)

| Tool | Purpose |
|------|---------|
| Git | Version control |
| GitHub / GitLab (self-hosted) | Code repository |
| ESLint + Prettier | Code style enforcement |
| Husky + lint-staged | Pre-commit hooks |
| GitHub Actions / GitLab CI | CI/CD pipeline for builds and tests |
| Sentry (self-hosted or log-based) | Error tracking |
| MkDocs or Docusaurus | Developer documentation site |

---

## 16. Database Schema Overview

### Core Entities

```
patients
├── id (PK)
├── op_id (unique, generated)
├── name
├── contact_number
├── address
├── date_of_birth
├── gender
├── blood_group
├── past_medical_history (JSON or text)
└── created_at, updated_at, archived_at

appointments
├── id (PK)
├── patient_id (FK → patients)
├── chair_id (FK → chairs)
├── treatment_id (FK → treatments)
├── scheduled_at
├── duration_minutes
├── status (enum: scheduled, confirmed, pending, completed, cancelled, rescheduled)
├── notes
├── confirmed_by (FK → users)
└── completed_at

treatments
├── id (PK)
├── name
├── category
├── default_duration_minutes
├── default_price
├── applicable_chairs (JSON array)
└── is_active

invoices
├── id (PK)
├── invoice_number (unique)
├── patient_id (FK → patients)
├── appointment_id (FK → appointments, optional)
├── subtotal
├── discount_amount
├── discount_reason
├── tax_amount
├── total_amount
├── amount_paid
├── status (enum: unpaid, partial, paid, voided)
└── created_at

invoice_items
├── id (PK)
├── invoice_id (FK → invoices)
├── treatment_id (FK → treatments)
├── description
├── quantity
├── unit_price
└── total_price

payments
├── id (PK)
├── invoice_id (FK → invoices)
├── amount
├── method (enum: cash, upi, card)
├── reference_number
├── paid_at
├── recorded_by (FK → users)
└── is_verified

dental_chart_entries
├── id (PK)
├── patient_id (FK → patients)
├── tooth_number (FDI notation)
├── surface (enum: mesial, distal, buccal, lingual, occlusal, full)
├── procedure_type
├── status (enum: planned, completed, ongoing)
├── notes
├── done_at
└── created_by (FK → users)

patient_images
├── id (PK)
├── patient_id (FK → patients)
├── treatment_id (FK → treatments, nullable)
├── appointment_id (FK → appointments, nullable)
├── file_path
├── thumbnail_path
├── image_type (enum: xray, intraoral_photo, before, after, other)
├── procedure_tag
├── tooth_number
├── notes
├── uploaded_by (FK → users)
└── uploaded_at

allergies
├── id (PK)
├── patient_id (FK → patients)
├── allergen_name
├── allergy_type
├── severity
├── reaction_description
└── noted_at

medications
├── id (PK)
├── patient_id (FK → patients)
├── medication_name
├── dosage, frequency, duration
├── prescribed_by, prescribed_on
├── reason
└── status

users
├── id (PK)
├── username
├── password_hash
├── role (enum: doctor, receptionist)
├── is_active
└── created_at

audit_logs
├── id (PK)
├── user_id (FK → users)
├── action
├── entity_type
├── entity_id
├── old_value (JSON)
├── new_value (JSON)
└── performed_at

inventory_items
├── id (PK)
├── branch_id (FK → branches, default 1 for v1.0)
├── item_name
├── category (enum: consumable, material, instrument, medicine, ppe, equipment)
├── unit_of_measure
├── minimum_stock_level
├── reorder_quantity
├── unit_cost
├── storage_location
├── supplier_name
├── notes
└── is_active

inventory_transactions
├── id (PK)
├── item_id (FK → inventory_items)
├── branch_id (FK → branches)
├── transaction_type (enum: stock_in_purchase, stock_in_return, stock_out_procedure, stock_out_wastage, stock_out_transfer, adjustment)
├── quantity (positive for in, negative for out)
├── unit_cost
├── batch_number
├── expiry_date
├── supplier_ref
├── linked_appointment_id (FK → appointments, nullable)
├── reason_notes
├── recorded_by (FK → users)
└── transaction_date

branches
├── id (PK)
├── name
├── address
└── is_active

```

---

## 17. Future Roadmap

### v2.0 — Multi-Clinic & Multi-Doctor Support

| Feature | Description |
|---------|-------------|
| Clinic entity | Each clinic has its own set of chairs, treatments, and staff |
| Doctor profiles | Multiple doctors per clinic with individual schedules |
| Multi-doctor scheduling | Appointments linked to specific doctor + chair |
| Clinic-level reporting | Revenue, patient volume, and appointment analytics per clinic |
| Multi-branch inventory | Stock transfer between branches, consolidated cross-branch reports, per-branch alerts |

### v3.0 — Cloud Migration (SaaS)

| Feature | Description |
|---------|-------------|
| Cloud database | Migrate from local SQLite/PostgreSQL to managed cloud DB (AWS RDS, Supabase) |
| Multi-tenant architecture | Isolated data per clinic in a shared cloud infrastructure |
| Web-based access | Replace Electron shell with hosted web app (Next.js or similar) |
| Patient portal | Optional patient-facing appointment booking and history view |
| Automated reminders | SMS/email appointment reminders via Twilio or AWS SES |
| Cloud backup | Automatic offsite backup to S3 or equivalent |
| Audit & compliance | Enhanced audit trails for regulatory compliance |

---

## 18. Glossary

| Term | Definition |
|------|------------|
| OP ID | Outpatient Identifier; a unique ID assigned to each patient upon registration |
| FDI Notation | Fédération Dentaire Internationale tooth numbering system (global standard) |
| Chair | A physical dental operating unit in the clinic; each has independent scheduling |
| SOAP | Subjective, Objective, Assessment, Plan — a structured clinical note format |
| RBAC | Role-Based Access Control — restricting system access based on user role |
| ACID | Atomicity, Consistency, Isolation, Durability — database transaction guarantee |
| AES-256 | Advanced Encryption Standard with 256-bit key; used for data-at-rest encryption |
| Ledger | A financial record of all payment transactions for reconciliation purposes |
| UPI | Unified Payments Interface — a real-time payment system used in India |
| Invoice | A formal billing document generated after a procedure is performed |
| Partial Payment | A payment that covers only a portion of the total invoice amount |
| Backup Archive | A compressed, encrypted file containing the full database and associated files |
| Audit Log | An append-only record of all data changes made within the system |
| Treatment Timeline | A chronological visual record of all procedures and images per patient |
| Stock Out | An inventory transaction recording the removal or consumption of items from stock |
| Stock In | An inventory transaction recording the receipt of new items into stock |
| Minimum Stock Level | The threshold quantity below which a low-stock alert is triggered |
| Branch | A physical clinic location; used to scope inventory in multi-clinic deployments |
| Batch Number | A supplier-assigned identifier for a specific production lot of a medicine or material |

---

*End of Document*

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | — | Initial draft from PRD input |
| 1.1 | 2026-05-23 | — | Added Treatment Timeline tab (§6.10), expanded Images Tab (§6.6), added Inventory Management module (§9), updated DB schema and roadmap |
