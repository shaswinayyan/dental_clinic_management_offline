# Dental Clinic Manager — Developer Guide

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Running & Building](#4-running--building)
5. [Architecture: Main / Preload / Renderer](#5-architecture-main--preload--renderer)
6. [IPC System](#6-ipc-system)
7. [Database](#7-database)
8. [Authentication & Role Guard](#8-authentication--role-guard)
9. [Key Frontend Patterns](#9-key-frontend-patterns)
10. [Adding a New Feature](#10-adding-a-new-feature)
11. [Billing System](#11-billing-system)
12. [Inventory & Pharmacy](#12-inventory--pharmacy)
13. [Dental Chart & Treatments](#13-dental-chart--treatments)
14. [Audit Logging](#14-audit-logging)
15. [Settings Store](#15-settings-store)
16. [PDF Generation](#16-pdf-generation)
17. [Common Gotchas](#17-common-gotchas)

---

## 1. Project Overview

Dental Clinic Manager is a **fully offline, on-premise** desktop application built with Electron. It runs entirely on the clinic's own Windows machine — no cloud, no external servers, no internet required (except for WhatsApp). All data lives in a local SQLite database.

**Core modules:**

| Module | Description |
|---|---|
| Patients | Demographics, medical history, allergies, medications, images |
| Appointments | Scheduler with multi-chair support, status tracking |
| Dental Chart | FDI tooth grid, per-surface charting, auto-sync from treatments |
| Treatments | Recorded procedures with dynamic area selector (tooth/arch/scope) |
| Clinical Notes | SOAP-format assessment notes per session |
| Prescriptions | Doctor-written Rx with dispensing workflow |
| Billing — Treatment | Invoice generation for clinical procedures |
| Billing — Pharmacy | Invoice for medicines with auto-stock deduction |
| Inventory | Multi-category stock management with batch/expiry tracking |
| Pharmacy Stock | Filtered view of `medicine` category items |
| Settings | Clinic profile, user management, backup/restore, audit log |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Desktop shell | Electron | ^33.2.1 |
| Build tool | electron-vite | ^2.3.0 |
| Frontend framework | React | ^18.3.1 |
| Language | TypeScript | ^5.7.2 |
| UI components | Ant Design | ^5.21.0 |
| Database | better-sqlite3 (SQLite) | ^11.5.0 |
| Password hashing | bcryptjs | ^2.4.3 |
| State management | Zustand | ^5.0.2 |
| Date handling | dayjs | ^1.11.13 |
| Backup | archiver | ^7.0.1 |
| IDs | uuid | ^11.0.3 |

---

## 3. Directory Structure

```
dental-clinic-manager/
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # Entry: creates BrowserWindow, registers IPC
│   │   ├── db/
│   │   │   ├── index.ts        # getDb() singleton — opens/creates SQLite file
│   │   │   └── schema.ts       # initializeSchema(), runMigrations(), seedDefaults()
│   │   ├── ipc/                # One file per domain, each exports register*Handlers()
│   │   │   ├── auth.ts
│   │   │   ├── patients.ts
│   │   │   ├── appointments.ts
│   │   │   ├── billing.ts
│   │   │   ├── inventory.ts
│   │   │   └── settings.ts
│   │   └── utils/
│   │       ├── audit.ts        # logAudit() helper
│   │       └── helpers.ts      # generateInvoiceNumber(), etc.
│   │
│   ├── preload/
│   │   └── index.ts            # contextBridge.exposeInMainWorld('api', api)
│   │
│   ├── renderer/               # React application (Vite)
│   │   └── src/
│   │       ├── main.tsx        # React entry point
│   │       ├── App.tsx         # Auth gate → MainLayout
│   │       ├── store/
│   │       │   └── authStore.ts     # Zustand: { user, setUser, logout }
│   │       ├── hooks/
│   │       │   └── useT.ts          # useT() → Ant Design theme tokens (dark/light)
│   │       ├── styles/
│   │       │   └── globals.css      # Global CSS + @media print rules
│   │       ├── components/
│   │       │   ├── Layout/
│   │       │   │   ├── MainLayout.tsx   # Router, breadcrumbs, page render
│   │       │   │   └── Sidebar.tsx      # Navigation sidebar
│   │       │   └── DentalChart/
│   │       │       └── DentalChart.tsx  # Interactive FDI tooth grid
│   │       └── pages/
│   │           ├── Login.tsx
│   │           ├── Dashboard.tsx
│   │           ├── Patients/
│   │           │   ├── PatientList.tsx
│   │           │   ├── PatientDetail.tsx   # Tabs: destroyInactiveTabPane!
│   │           │   └── tabs/
│   │           │       ├── DentalChartTab.tsx
│   │           │       ├── TreatmentsTab.tsx
│   │           │       ├── AssessmentsTab.tsx
│   │           │       ├── PrescriptionsTab.tsx
│   │           │       └── ...
│   │           ├── Appointments/
│   │           ├── Billing/
│   │           │   ├── BillingList.tsx
│   │           │   ├── InvoiceDetail.tsx
│   │           │   ├── PharmacyBilling.tsx
│   │           │   └── PharmacyBillingForm.tsx
│   │           ├── Inventory/
│   │           │   ├── InventoryList.tsx
│   │           │   └── PharmacyStock.tsx
│   │           └── Settings/
│   │               ├── SettingsPage.tsx
│   │               └── UserManagement.tsx
│   │
└── shared/
    └── types.ts              # Shared TypeScript interfaces (IpcResult, Patient, Invoice…)
```

---

## 4. Running & Building

### Development

```bash
npm install
# Rebuild native modules (better-sqlite3) for Electron
npm run postinstall

# Start in dev mode (hot-reload renderer, no hot-reload for main)
npm run dev
```

> **Note:** If main process code changes, restart `npm run dev`.  
> The build tool is invoked as `node node_modules/electron-vite/bin/electron-vite.js` internally.

### Production Build

```bash
npm run build        # Compile only (outputs to out/)
npm run package      # Build + package to installer (outputs to dist/)
```

The packager uses **electron-builder** with NSIS for Windows installer.  
Output: `dist/Dental Clinic Manager Setup 1.0.0.exe`

### Build Output

```
out/
├── main/index.js        # Bundled main process
├── preload/index.js     # Bundled preload script
└── renderer/index.html  # Bundled React app
```

---

## 5. Architecture: Main / Preload / Renderer

```
┌─────────────────────────────────┐
│  Renderer (React)               │
│  window.api.patients.list()     │
│         │                       │
│  contextBridge (preload)        │
│         │                       │
│  ipcRenderer.invoke('patients:list')
└─────────────┬───────────────────┘
              │  IPC (secure boundary)
┌─────────────┴───────────────────┐
│  Main Process (Node.js)         │
│  ipcMain.handle('patients:list')│
│         │                       │
│  better-sqlite3 → SQLite file   │
└─────────────────────────────────┘
```

- **contextIsolation: true** — renderer cannot access Node APIs directly.
- **nodeIntegration: false** — no `require()` in renderer.
- All communication goes through `window.api.*` which is the contextBridge-exposed object.

---

## 6. IPC System

### Pattern

Every IPC handler follows this signature:

```ts
// Main process (src/main/ipc/*.ts)
ipcMain.handle('domain:action', async (_event, ...args) => {
  try {
    const db = getDb()
    // ... do work ...
    return { success: true, data: result }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
})
```

```ts
// Preload (src/preload/index.ts)
domain: {
  action: (...args) => invoke('domain:action', ...args)
}
```

```ts
// Renderer (React component)
const res = await window.api.domain.action(...args) as IpcResult<MyType>
if (res.success && res.data) { /* use res.data */ }
```

### IpcResult type

```ts
// src/shared/types.ts
interface IpcResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
```

### Registered handlers by file

| File | Handlers (channel prefix) |
|---|---|
| `auth.ts` | `auth:login`, `auth:listUsers`, `auth:createUser`, `auth:resetPassword`, `auth:toggleUser`, `auth:initAdmin`, `auth:credentialsChanged` |
| `patients.ts` | `patients:list`, `patients:get`, `patients:create`, `patients:update`, `patients:archive`, `patients:getDentalChart`, `patients:addChartEntry`, `patients:listTreatments`, `patients:addTreatmentRecord`, `patients:listPrescriptions`, `patients:createPrescription`, … |
| `appointments.ts` | `appointments:list`, `appointments:get`, `appointments:create`, `appointments:update`, `appointments:updateStatus`, `appointments:reschedule`, `appointments:listChairs`, `appointments:listTreatments`, … |
| `billing.ts` | `billing:listInvoices`, `billing:getInvoice`, `billing:createInvoice`, `billing:addPayment`, `billing:voidInvoice`, `billing:verifyPayment`, `billing:listLedger`, `billing:consolidatedReport`, `billing:printInvoice`, … |
| `inventory.ts` | `inventory:listItems`, `inventory:createItem`, `inventory:recordTransaction`, `inventory:getDashboard`, `inventory:getReport`, … |
| `settings.ts` | `settings:get`, `settings:update`, `settings:backup`, `settings:restore`, `settings:getAuditLog`, `settings:openExternal`, … |

---

## 7. Database

### Location

The SQLite file is created at Electron's `userData` path:

```
Windows: C:\Users\<username>\AppData\Roaming\dental-clinic-manager\clinic.db
```

Access via `app.getPath('userData')` in main process.

### DB Singleton

```ts
// src/main/db/index.ts
import Database from 'better-sqlite3'
let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) _db = new Database(dbPath)
  return _db
}
```

### Schema Summary

| Table | Purpose |
|---|---|
| `users` | Login accounts with bcrypt-hashed passwords |
| `app_settings` | Key/value store (clinic name, tax rate, flags, etc.) |
| `patients` | Patient demographics; `op_id` is auto-generated unique identifier |
| `appointments` | Scheduled visits linked to chair + treatment + patient |
| `dental_chart_entries` | Per-tooth, per-surface procedure records |
| `treatment_records` | Treatment history with `tooth_area` text field |
| `clinical_assessments` | SOAP notes |
| `prescriptions` + `prescription_items` | Doctor Rx with line items |
| `patient_images` | File paths to stored images |
| `invoices` | Billing headers; `billing_type` = `'treatment'` or `'pharmacy'` |
| `invoice_items` | Line items for each invoice |
| `payments` | Payment records with verification workflow |
| `inventory_items` | Stock items by category |
| `inventory_transactions` | All stock movements (in/out/adjustment) |
| `audit_logs` | Immutable action log |

### Migrations

New columns added post-initial-release go in `runMigrations()` in `schema.ts`:

```ts
export function runMigrations(db: Database.Database): void {
  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'treatment'`).run()
  } catch { /* already exists — safe to ignore */ }
}
```

`runMigrations()` is called in `db/index.ts` between `initializeSchema()` and `seedDefaults()`.

### Adding a Migration

1. Add a `try/catch ALTER TABLE` block inside `runMigrations()`.
2. The `catch` must be silent — SQLite throws when the column already exists.
3. Never drop or rename columns — use migrations only to add.

---

## 8. Authentication & Role Guard

### Roles

| Role | Access |
|---|---|
| `doctor` | Full access to all modules; can add/edit chart entries, create prescriptions, reset passwords |
| `receptionist` | Read-only on clinical modules; full access to appointments and billing |

### Auth store

```ts
// src/renderer/src/store/authStore.ts
interface AuthState {
  user: User | null
  setUser: (user: User) => void
  logout: () => void
}
```

Persisted in memory only — resets on app restart (user must log in again).

### Role checks in components

```tsx
const { user } = useAuthStore()

// Hide write actions for receptionist
<Button disabled={user?.role !== 'doctor'}>Add Entry</Button>

// Or hide entirely
{user?.role === 'doctor' && <Button>Reset Password</Button>}
```

### Default credentials flag

`app_settings` has a `credentials_changed` key (`'0'` = still default, `'1'` = changed).  
Set to `'0'` on `auth:initAdmin` (fresh install).  
Set to `'1'` on any `auth:resetPassword` call.  
`Login.tsx` fetches this on mount to conditionally show the first-time setup hint.

---

## 9. Key Frontend Patterns

### Adaptive theme tokens

```ts
// src/renderer/src/hooks/useT.ts
import { theme } from 'antd'
export function useT() {
  const { token } = theme.useToken()
  return token
}
```

Use `t.colorBgContainer`, `t.colorText`, `t.colorBorder` etc. for dark/light compatibility.  
Never hardcode `#fff` or `#000` for backgrounds — use tokens.

### Tab panel data refresh

Patient detail uses `destroyInactiveTabPane` on Ant Design `<Tabs>`:

```tsx
<Tabs destroyInactiveTabPane ... />
```

This unmounts inactive tab panels completely. Each panel's `useEffect([patientId])` then re-runs whenever the tab is revisited, ensuring fresh data. **This is intentional — do not remove it.**

### Navigation (single-page, no router library)

Navigation state lives in `MainLayout.tsx`:

```ts
type Page = { page: 'dashboard' } | { page: 'patients' } | { page: 'patient-detail'; patientId: number } | ...
const [currentPage, setCurrentPage] = useState<Page>({ page: 'dashboard' })
```

`navigate(page)` is passed down as a prop. There is no URL routing.

### IpcResult pattern (renderer)

```ts
const res = await window.api.patients.list() as IpcResult<Patient[]>
if (!res.success) { message.error(res.error); return }
setPatients(res.data ?? [])
```

Always check `.success` before using `.data`. Never assume data is present.

---

## 10. Adding a New Feature

### Step-by-step checklist

1. **Schema**: Add table or column in `schema.ts` (`initializeSchema` for new tables, `runMigrations` for new columns).

2. **Types**: Add interface to `src/shared/types.ts`.

3. **IPC handlers**: Add to appropriate `src/main/ipc/*.ts` file. Follow the `try/catch → IpcResult` pattern.

4. **Preload**: Expose the new handler in `src/preload/index.ts` under the appropriate domain object.

5. **Page/component**: Create React component in `src/renderer/src/pages/`.

6. **Route**: Add to `MainLayout.tsx`:
   - Add to `Page` union type
   - Add breadcrumb in the breadcrumb map
   - Add `case` in the render switch

7. **Sidebar**: Add menu item in `Sidebar.tsx` if it needs a top-level nav entry.

8. **Audit log**: Call `logAudit(db, userId, 'ACTION', 'entity', id, 'description')` for any write operation.

---

## 11. Billing System

### Invoice lifecycle

```
created (unpaid)
  ↓ addPayment (partial if amount < total)
partial
  ↓ addPayment (when total paid)
paid
  OR
voided (any time by doctor)
```

### Billing types

- **`treatment`** — Clinical procedures, created from `BillingList.tsx`
- **`pharmacy`** — Medicine sales, created from `PharmacyBillingForm.tsx`; automatically deducts `inventory_transactions` (`stock_out_procedure`) for items with `item_id`

### Invoice number format

Generated by `generateInvoiceNumber(db)` in `src/main/utils/helpers.ts`:  
Format: `INV-YYYYMM-NNNN` (sequential within the month).

### Payment verification

Payments have `is_verified` flag. Receptionists record payments; doctors or admin verify them. `billing:markAllVerifiedToday` bulk-verifies all unverified payments from today.

---

## 12. Inventory & Pharmacy

### Categories

`consumable`, `material`, `instrument`, `medicine`, `ppe`, `equipment`

`PharmacyStock.tsx` filters to `category='medicine'` only.

### Transaction types

| Type | Direction | When |
|---|---|---|
| `stock_in_purchase` | + | New stock added |
| `stock_in_return` | + | Returned items |
| `stock_out_procedure` | − | Used in procedure or pharmacy billing |
| `stock_out_wastage` | − | Disposed/expired |
| `stock_out_transfer` | − | Moved elsewhere |
| `adjustment` | +/− | Manual correction |

**Current stock** = `SUM(quantity)` across all transactions for an item (stored in the transactions table as signed values — negative for out, positive for in).

---

## 13. Dental Chart & Treatments

### FDI numbering

- Q1 (upper right): 11–18
- Q2 (upper left): 21–28
- Q3 (lower left): 31–38
- Q4 (lower right): 41–48

### Area modes

`TreatmentsTab.tsx` classifies each treatment into an area mode:

| Mode | UI | When |
|---|---|---|
| `tooth` | FDI 32-tooth grid, multi-select | Restorative, Endodontic, Surgical, specific Prosthodontic/Cosmetic |
| `arch` | Upper / Lower / Both buttons | Orthodontic, arch Prosthodontic (dentures) |
| `scope` | Full Mouth / Quadrant picker | Preventive, Periodontal, whitening/bleaching |

### Auto-sync to dental chart

`patients:addTreatmentRecord` (IPC handler in `patients.ts`) extracts FDI numbers from `tooth_area` using regex `/\b([1-8][1-8])\b/g` and inserts a `dental_chart_entries` row for each matched tooth, using `surface='full'` and the treatment name as `procedure_type`.

---

## 14. Audit Logging

```ts
// src/main/utils/audit.ts
export function logAudit(
  db: Database.Database,
  userId: number,
  action: string,       // e.g. 'CREATE', 'UPDATE', 'DELETE', 'ADD_PAYMENT'
  entityType: string,   // e.g. 'invoice', 'patient', 'appointment'
  entityId: number,
  details: string
): void
```

Called after every write operation in IPC handlers. Entries are visible in Settings → Audit Log with date/user/action filters.

---

## 15. Settings Store

`app_settings` is a flat key/value SQLite table. Known keys:

| Key | Default | Description |
|---|---|---|
| `clinic_name` | `My Dental Clinic` | Shown in PDF invoices |
| `clinic_address` | `''` | Shown in PDF invoices |
| `clinic_phone` | `''` | Shown in PDF invoices |
| `tax_rate` | `18` | GST % applied to invoices |
| `discount_threshold` | `20` | Max % discount without doctor approval |
| `session_timeout_minutes` | `30` | Auto-logout timer |
| `backup_enabled` | `0` | Scheduled backup on/off |
| `backup_time` | `23:00` | Time for scheduled backup |
| `backup_retain_count` | `7` | Number of backup files to keep |
| `backup_path` | `''` | Destination folder for backups |
| `expiry_alert_days` | `30` | Days before expiry to alert |
| `credentials_changed` | `0` | `1` after any password reset |

Access via `settings:get` (returns all as object) and `settings:update` (patch object).

---

## 16. PDF Generation

Invoice PDFs use Electron's `webContents.printToPDF()` API:

1. Renderer generates a complete self-contained HTML string (inline CSS, no external fonts).
2. Renderer calls `window.api.billing.printInvoice(html, invoiceNumber)`.
3. Main process (`billing:printInvoice` handler):
   - Writes HTML to a temp file (`app.getPath('temp')`).
   - Opens a hidden `BrowserWindow`, loads the HTML file.
   - Waits 400 ms for fonts/layout to settle.
   - Calls `win.webContents.printToPDF({ pageSize: 'A4', printBackground: true })`.
   - Writes PDF bytes to temp file.
   - Opens the PDF with the system default viewer via `shell.openPath()`.
   - Cleans up the temporary HTML file.

Use `&#x20b9;` for the Indian Rupee symbol (₹) inside the HTML — do not use the literal character, which may not render in the hidden window's font.

---

## 17. Common Gotchas

### `better-sqlite3` is synchronous
All DB calls block the main process thread. Keep queries fast — no heavy JOINs inside tight loops.

### Native module rebuild required
After `npm install` or after changing Electron version, always run:
```bash
npm run postinstall   # runs electron-rebuild -f -w better-sqlite3
```

### `contextIsolation: true` means no `require()` in renderer
Never import Node modules in renderer code. All system access must go through IPC.

### Ant Design `<Tabs>` caches panels by default
Without `destroyInactiveTabPane`, a tab's `useEffect` only runs once. If a tab needs fresh data each visit (e.g., DentalChartTab after adding a treatment), the parent `<Tabs>` must have `destroyInactiveTabPane`.

### SQLite `ALTER TABLE` on existing column throws
Always wrap column migrations in `try/catch` — SQLite throws `"duplicate column name"` if the column already exists, which is expected on re-runs.

### `billing_type` column migration
Added via `runMigrations()`. Existing invoices default to `'treatment'`. Any code checking `billing_type` must handle this column being absent on very old databases — the migration guards against this.

### WhatsApp redirect
Uses `https://wa.me/{phone}?text={encoded}` opened via `shell.openExternal()`. Phone number must be in international format without `+` (e.g., `919876543210`). The handler in `settings.ts` is `settings:openExternal`.
