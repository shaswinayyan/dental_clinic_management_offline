# Dental Clinic Manager — User Guide

**Version 1.0 · Offline · Windows**

---

## Table of Contents

1. [Installation from GitHub](#1-installation-from-github)
2. [First-Time Setup](#2-first-time-setup)
3. [Logging In](#3-logging-in)
4. [Dashboard](#4-dashboard)
5. [Managing Patients](#5-managing-patients)
6. [Appointments](#6-appointments)
7. [Patient Records & Clinical Workflow](#7-patient-records--clinical-workflow)
8. [Dental Chart](#8-dental-chart)
9. [Prescriptions](#9-prescriptions)
10. [Billing — Treatments](#10-billing--treatments)
11. [Billing — Pharmacy](#11-billing--pharmacy)
12. [Inventory Management](#12-inventory-management)
13. [Pharmacy Stock](#13-pharmacy-stock)
14. [WhatsApp Reminders](#14-whatsapp-reminders)
15. [Reports](#15-reports)
16. [Settings](#16-settings)
17. [Backup & Restore](#17-backup--restore)
18. [User Management](#18-user-management)
19. [Frequently Asked Questions](#19-frequently-asked-questions)

---

## 1. Installation from GitHub

> This guide covers setting up the application on a **fresh Windows PC** using the source code from the GitHub repository. You only need to do this once. After the setup is complete, the application runs like any normal Windows program.

---

### System Requirements

| Requirement | Minimum |
|---|---|
| Operating System | Windows 10 (64-bit) or Windows 11 |
| RAM | 4 GB |
| Disk Space | 2 GB free during setup (≈ 500 MB after install) |
| Display | 1280 × 720 or higher |
| Internet | Required during setup only |

---

### Overview of Steps

Setting up from the GitHub repository involves four stages:

```
1. Install prerequisites  →  2. Download the code  →  3. Build the app  →  4. Install & launch
```

This takes approximately **15–30 minutes** on the first setup.

---

### Step 1 — Install Prerequisites

You need three programs installed before you can build the application. Follow each sub-step below.

---

#### 1A — Install Node.js

Node.js is the engine that builds and runs the application.

1. Open your browser and go to: **https://nodejs.org**
2. Click the **"LTS"** download button (the one labelled "Recommended For Most Users").
3. Run the downloaded installer (`node-v*.msi`).
4. On the "Tools for Native Modules" screen, **check the box** that says:  
   ✅ *"Automatically install the necessary tools"*  
   This installs the C++ build tools needed for the database module.
5. Click **Next → Install → Finish**.
6. A separate black command window will open and install additional tools — **wait for it to finish** and press any key when asked.

> **Verify:** Open **Command Prompt** (`Win + R` → type `cmd` → Enter) and type:  
> `node --version`  
> You should see something like `v20.x.x`. If you do, Node.js is installed correctly.

---

#### 1B — Install Git

Git is used to download the source code from GitHub.

1. Go to: **https://git-scm.com/download/win**
2. The download starts automatically — run the installer.
3. Accept all default settings and click **Next** through all screens.
4. Click **Install**, then **Finish**.

> **Verify:** In Command Prompt, type:  
> `git --version`  
> You should see `git version 2.x.x`.

---

#### 1C — Install Visual Studio Build Tools (if not already installed by Node.js)

> **Skip this step** if you checked "Automatically install the necessary tools" in Step 1A — they were already installed.

If you skipped that checkbox:

1. Go to: **https://visualstudio.microsoft.com/visual-cpp-build-tools/**
2. Download and run **Build Tools for Visual Studio**.
3. In the installer, select **"Desktop development with C++"** workload.
4. Click **Install**. This may take several minutes.

---

### Step 2 — Download the Source Code

1. Open **Command Prompt** (`Win + R` → `cmd` → Enter).

2. Navigate to where you want to store the project. For example, your Documents folder:
   ```
   cd %USERPROFILE%\Documents
   ```

3. Clone the repository (replace the URL with the actual GitHub repo URL):
   ```
   git clone https://github.com/YOUR-USERNAME/dental-clinic-manager.git
   ```
   > This creates a folder called `dental-clinic-manager` with all the source code inside.

4. Move into that folder:
   ```
   cd dental-clinic-manager
   ```

---

### Step 3 — Install Dependencies and Build

Run the following commands **one at a time** in the same Command Prompt window. Wait for each to finish before typing the next.

> ⚠️ **Important:** Always use **`npm`** to install packages. Do **not** use `pnpm`, `yarn`, or any other package manager — they create a different folder structure that causes a `Cannot find module 'archiver-utils'` error when the app launches.

#### 3A — Install all packages
```
npm install
```
> This downloads all required libraries **and automatically rebuilds the database module for Electron**. It may take 5–10 minutes on the first run. You will see a lot of text including a `✔ Rebuild Complete` line — this is normal.

#### 3B — Verify the rebuild succeeded
After `npm install` finishes, confirm you see this line in the output:
```
✔ Rebuild Complete
```
> If this line is missing, run `npm run postinstall` manually and wait for it to complete before continuing.

#### 3C — Build the application
```
npm run build
```
> Compiles all source code into the final application files. Takes about 1–2 minutes.

#### 3D — Package as a Windows installer
```
npm run package
```
> Creates a Windows `.exe` installer file. Takes 2–3 minutes.

When finished, you will see a message like:
```
  • building        target=nsis name="Dental Clinic Manager"
  • built           path=dist\Dental Clinic Manager Setup 1.0.0.exe
```

---

### Step 4 — Install and Launch

1. Open **File Explorer** and navigate to:
   ```
   Documents\dental-clinic-manager\dist\
   ```

2. Double-click:  
   **`Dental Clinic Manager Setup 1.0.0.exe`**

3. Click **"Next"** on the welcome screen.

4. Choose your installation folder (the default is recommended) and click **"Install"**.

5. When the installation completes, click **"Finish"**.  
   A shortcut is created on your Desktop.

6. Double-click the **Dental Clinic Manager** icon on your Desktop to launch the application.

> **From this point on**, you launch the app from the Desktop shortcut — you never need to open Command Prompt again.

---

### Updating to a New Version

When a new version is released on GitHub:

1. Open Command Prompt and go to the project folder:
   ```
   cd %USERPROFILE%\Documents\dental-clinic-manager
   ```

2. Pull the latest changes:
   ```
   git pull
   ```

3. Reinstall packages (in case new dependencies were added):
   ```
   npm install
   ```
   > `npm install` automatically rebuilds native modules — no separate `npm run postinstall` needed.

4. Rebuild and repackage:
   ```
   npm run package
   ```

5. Run the new installer from the `dist\` folder.  
   Your existing patient data is **not affected** — it lives in a separate database folder, not inside the app folder.

---

### Troubleshooting Common Setup Issues

| Problem | Solution |
|---|---|
| `'node' is not recognized` | Node.js was not installed correctly. Re-run the Node.js installer. |
| `'git' is not recognized` | Restart Command Prompt after installing Git — or re-install Git. |
| `node-gyp` or `MSBuild` errors during `npm install` | The C++ build tools are missing. Run Step 1C above. |
| `npm install` fails with proxy/network errors | Check your internet connection. If on a corporate network, ask IT about npm proxy settings. |
| `Cannot find module 'archiver-utils'` on launch | You installed packages with `pnpm` or another package manager. Delete the `node_modules` folder, then run `npm install` (npm only). |
| `npm run package` fails with icon error | Ensure `resources/icon.ico` exists in the project folder. |
| Application opens but shows a blank screen | Run `npm run build` again, then `npm run package`. |
| Black screen on launch | Right-click the desktop shortcut → "Run as administrator" once to check if it's a permissions issue. |

> **Still stuck?** Share the full error message with the person who shared the GitHub repository.

---

> **Important:** The application stores all data on this computer.  
> Back up regularly — see [Section 17: Backup & Restore](#17-backup--restore).

---

## 2. First-Time Setup

When you launch the application for the first time:

### Step 1 — Log in with default credentials

> The login screen will show a **yellow notice** with the default usernames and passwords.  
> This notice disappears permanently once you change the passwords — keep this guide handy until then.

Default accounts:

| Username | Password | Role |
|---|---|---|
| `doctor` | `admin123` | Doctor (full access) |
| `receptionist` | `reception123` | Receptionist |

Log in as **`doctor`** first.

---

### Step 2 — Set up Clinic Information

1. Click **Settings** in the left sidebar (bottom).
2. On the **General** tab, fill in:
   - **Clinic Name** — appears on all printed invoices
   - **Address** — appears on invoices
   - **Phone Number** — appears on invoices
   - **Tax Rate (%)** — GST rate (default 18%)
3. Click **Save Settings**.

---

### Step 3 — Change Default Passwords (Required)

> ⚠ **Security:** Change both default passwords immediately. The default passwords are publicly known.

1. In **Settings**, click the **User Management** tab.
2. Find the **doctor** user — click **Reset Password**.
3. Enter a strong new password and confirm it.
4. Click **Save**. The login screen hint will disappear from now on.
5. Repeat for the **receptionist** user.

---

### Step 4 — Set Up Chairs (Optional)

The system comes with 3 chairs pre-configured (Chair 1 / Chair 2 / Chair 3).  
To rename or add chairs, go to **Settings → Chairs**.

---

## 3. Logging In

1. Open **Dental Clinic Manager** from your desktop.
2. Enter your **Username** and **Password**.
3. Click **Sign In**.

Each role has different permissions:

| Feature | Doctor | Receptionist |
|---|---|---|
| View patient records | ✓ | ✓ |
| Add/edit treatments | ✓ | — |
| Write prescriptions | ✓ | — |
| Edit dental chart | ✓ | — |
| Create & view invoices | ✓ | ✓ |
| Manage appointments | ✓ | ✓ |
| Reset user passwords | ✓ | — |
| Manage inventory | ✓ | ✓ |

---

## 4. Dashboard

The **Dashboard** is the first screen after logging in. It shows:

- **Today's Appointments** — a live list of who is scheduled today
- **Pending Payments** — invoices that are unpaid or partially paid
- **Revenue This Month** — total billed vs collected
- **Low Stock Alerts** — inventory items below minimum level
- **Quick Stats** — total patients, today's appointments count, outstanding amount

Click any appointment card to jump directly to that patient's record.

---

## 5. Managing Patients

### Registering a New Patient

1. Click **Patients** in the sidebar.
2. Click **+ New Patient** (top right).
3. Fill in the required fields:
   - **Full Name** *(required)*
   - **Contact Number** *(required — must be unique)*
   - **Date of Birth** — used for age calculation
   - **Gender**
   - **Address**
   - **Blood Group**
   - **Emergency Contact**
   - **Past Medical History** — brief notes on existing conditions
4. Click **Save Patient**.

The system automatically generates an **OP ID** (e.g., `OP-00123`) for every patient. Use this ID for all printed cards and receipts.

---

### Searching for a Patient

- Type any part of the **name**, **contact number**, or **OP ID** in the search box.
- Results update as you type.
- Use the **"Show Archived"** toggle to see inactive patients.

---

### Patient Profile Overview

Clicking a patient opens their full profile with these tabs:

| Tab | Contents |
|---|---|
| **Overview** | Demographics, allergies, medications |
| **Appointments** | Visit history |
| **Treatments** | Procedure records with area details |
| **Dental Chart** | Visual FDI tooth chart + scope treatments |
| **Clinical Notes** | SOAP assessment notes |
| **Prescriptions** | Doctor Rx history |
| **Images** | X-rays and clinical photos |
| **Timeline** | Chronological event history |
| **Billing** | Invoices linked to this patient |

---

### Allergies & Medications

In the **Overview** tab:

- **Add Allergy** — record allergen name, type (Drug/Food/Material/Other), severity, and reaction
- **Add Medication** — record medication name, dosage, frequency, and duration
- Update medication status to **Active**, **Completed**, or **Discontinued**

> ⚠ Allergy information is highlighted prominently. Always check before prescribing.

---

### Archiving a Patient

If a patient is no longer active:

1. Open the patient's profile.
2. Click the **Archive** button (top right).
3. Confirm the action.

Archived patients are hidden from the main list but can be restored. Their records are never deleted.

---

## 6. Appointments

### Booking an Appointment

1. Click **Appointments** in the sidebar.
2. Click **+ New Appointment**.
3. Fill in:
   - **Patient** — search by name or OP ID
   - **Date & Time**
   - **Chair** — the dental chair/room
   - **Treatment** — the procedure planned
   - **Duration** — auto-filled from treatment defaults
   - **Notes** (optional)
4. Click **Book Appointment**.

---

### Appointment Status Flow

| Status | Meaning |
|---|---|
| **Scheduled** | Booked, awaiting confirmation |
| **Confirmed** | Patient confirmed attendance |
| **Pending** | Patient arrived, waiting |
| **Completed** | Visit done |
| **Cancelled** | Appointment cancelled |
| **Rescheduled** | Moved to a different time |

To change status, open the appointment and use the status dropdown or action buttons.

---

### Calendar View

The appointment page shows a **weekly calendar** with colour-coded slots per chair.  
Click any time slot to book a new appointment for that time.

---

## 7. Patient Records & Clinical Workflow

### Recording a Treatment

1. Open the patient's profile → **Treatments** tab.
2. Click **+ Add Treatment**.
3. Select the **Treatment/Procedure** from the dropdown.
4. The **Area Selector** changes automatically based on the procedure type:

   | Procedure Type | Area Selection |
   |---|---|
   | Restorative, Endodontic, Surgical | Click specific teeth on the FDI grid |
   | Orthodontic, Dentures | Choose Upper Jaw / Lower Jaw / Both Jaws |
   | Preventive, Periodontal, Whitening | Choose Full Mouth / Arch / Quadrant |

5. Select the **Status**: Completed / Ongoing / Planned
6. Add **Notes** if needed.
7. Click **Save**.

> Treatments with specific tooth numbers automatically appear on the **Dental Chart**.

---

### SOAP Clinical Notes

1. Go to **Clinical Notes** tab.
2. Click **+ New Assessment**.
3. Fill in:
   - **S (Subjective)** — patient's complaint in their own words
   - **O (Objective)** — your clinical findings (exam, vitals)
   - **A (Assessment)** — diagnosis or clinical impression
   - **P (Plan)** — treatment plan, next steps
4. Click **Save**.

Previous assessments are shown chronologically. Only doctors can add assessments.

---

## 8. Dental Chart

### Viewing the Chart

Open a patient → **Dental Chart** tab.

The chart shows:
- **Full FDI 32-tooth grid** — upper jaw on top, lower jaw on bottom
- Colour-coded teeth based on recorded status:
  - 🟢 Green = Completed procedure
  - 🟠 Orange = Ongoing treatment
  - 🔵 Blue = Planned treatment
  - White/grey = No record

Hover over any tooth to see its number (FDI notation).

---

### Adding a Chart Entry (Doctors Only)

1. Click any tooth on the chart.
2. A form appears — fill in:
   - **Surface** — Mesial / Distal / Buccal / Lingual / Occlusal / Full
   - **Procedure Type** — what was done
   - **Status** — Planned / Ongoing / Completed
   - **Notes** (optional)
3. Click **Save**.

---

### Arch & Scope-Level Treatments

Below the tooth grid, you will see a panel: **"Arch & Scope-Level Treatments"**.  
This shows procedures that apply to the whole mouth or arches (e.g., Scaling, Orthodontics, Whitening) — they appear here instead of individual teeth.

---

## 9. Prescriptions

### Writing a Prescription (Doctors Only)

1. Open patient → **Prescriptions** tab.
2. Click **+ New Prescription**.
3. Fill in:
   - **Diagnosis** (optional)
   - **General Notes**
   - Add medicines using **+ Add Medicine**:
     - Medicine name
     - Dosage (e.g., "500mg")
     - Frequency (e.g., "Twice daily")
     - Duration (e.g., "5 days")
     - Quantity
     - Instructions (e.g., "After food")
4. Click **Save Prescription**.

---

### Dispensing a Prescription

When the patient collects their medicines:

1. Find the prescription in the list.
2. Click **Mark Dispensed**.
3. The status changes from **Active** to **Dispensed**.

Dispensed prescriptions can be directly added to a **Pharmacy Bill** — see [Section 11](#11-billing--pharmacy).

---

## 10. Billing — Treatments

### Creating a Treatment Invoice

1. Click **Billing** in the sidebar.
2. Click **+ New Invoice**.
3. Search for the **Patient**.
4. Add line items:
   - Select a **Treatment** from the list (price auto-fills)
   - Or type a custom **Description** with a manual price
   - Set **Quantity**
5. Apply **Discount** (if any) and add a reason.
6. **Tax** is calculated automatically based on settings.
7. Click **Create Invoice**.

---

### Recording a Payment

1. Open an invoice (from the Billing list or patient's Billing tab).
2. Click **Add Payment**.
3. Enter:
   - **Amount**
   - **Method**: Cash / UPI / Card
   - **Reference Number** (for UPI/Card)
   - **Notes** (optional)
4. Click **Save Payment**.

The invoice status updates automatically:  
- Partial payment → **Partial**  
- Full amount paid → **Paid**

---

### Exporting as PDF

1. Open any invoice.
2. Click **Export PDF** (top right of the invoice).
3. A PDF is generated and opens in your default PDF viewer (e.g., Adobe Reader).
4. Print from there, or save to share.

The PDF includes: clinic header, invoice number, patient details, itemised list, totals, and payment history.

---

### Voiding an Invoice

If an invoice was created in error:

1. Open the invoice.
2. Click **Void Invoice**.
3. Enter the reason.
4. Confirm.

Voided invoices cannot be un-voided. They remain in the system for audit purposes.

---

## 11. Billing — Pharmacy

Pharmacy billing creates a separate invoice for medicines sold to the patient.

### Creating a Pharmacy Invoice

1. Click **Pharmacy Billing** in the sidebar (under Finance).
2. Click **+ New Pharmacy Bill**.
3. Search for and select the **Patient**.
4. Add medicines either:
   - **From active prescriptions** — click **View Prescriptions**, then **Add to Bill** for each item
   - **From pharmacy stock** — browse available medicines and click **Add** next to each
5. Adjust quantities as needed.
6. Set **Discount** and **Tax** if applicable.
7. Click **Create Invoice**.

> When the pharmacy invoice is created, stock is automatically deducted from inventory for each medicine that has an inventory record.

---

## 12. Inventory Management

### Adding a New Item

1. Click **Inventory** in the sidebar.
2. Click **+ Add Item**.
3. Fill in:
   - **Item Name**
   - **Category** — Consumable / Material / Instrument / Medicine / PPE / Equipment
   - **Unit** (Piece, Box, ML, etc.)
   - **Minimum Stock Level** — alerts when stock drops below this
   - **Unit Cost**
   - **Supplier**, **Storage Location** (optional)
4. Click **Save**.

---

### Recording Stock In

1. Find the item in the inventory list.
2. Click **Stock In**.
3. Enter:
   - **Quantity**
   - **Batch Number** (optional)
   - **Expiry Date** (important for medicines)
   - **Supplier Reference** (optional)
4. Click **Save**.

---

### Viewing Transaction History

Click the **History** icon next to any item to see all stock movements — purchases, usages, adjustments — with dates and recorded-by user.

---

### Low Stock Alerts

Items below their minimum stock level are highlighted in red/orange on the inventory list. The Dashboard also shows a **Low Stock Alert** count.

---

## 13. Pharmacy Stock

**Pharmacy Stock** is a focused view of all inventory items in the **Medicine** category.

1. Click **Pharmacy Stock** in the sidebar (under Physical Assets).
2. See medicines with current stock levels, low stock warnings, and expiry status.
3. Use the filter buttons: **All / Low Stock / Out of Stock**.
4. Use **Stock In** to replenish and **History** to review usage.

---

## 14. WhatsApp Reminders

Send a quick professional message to any patient via WhatsApp:

1. Open the patient's profile.
2. Click the green **WhatsApp** button (top right of the patient header).
3. Select a message template:
   - **Appointment Reminder** — reminds of upcoming appointment
   - **Follow-up Check** — post-treatment follow-up
   - **Payment Due** — gentle payment reminder
   - **Routine Check-up** — recall message
4. Preview the message.
5. Click **Open WhatsApp**.

> Your default browser opens **web.whatsapp.com** with the patient's number and message pre-filled.  
> The patient's number must be a valid 10-digit Indian mobile number.

---

## 15. Reports

### Payment Ledger

**Billing → Payment Ledger**

Shows all individual payment transactions with:
- Date, patient name, invoice number
- Amount, method (Cash / UPI / Card)
- Recorded by, verified status

Filter by date range, payment method, or verification status.

Use **Mark All Verified (Today)** to bulk-verify today's cash collections.

---

### Consolidated Report

**Billing → Consolidated Report**

Summarises invoices for a date range:
- Total billed
- Collected by Cash / UPI / Card
- Outstanding (unpaid + partial)

Filter by date range and status.

---

### Inventory Reports

**Inventory → Reports**

Available reports:
- **Stock Summary** — current levels for all items
- **Low Stock** — items below minimum level
- **Expiry Report** — items expiring within alert window
- **Transaction Log** — all stock movements

---

## 16. Settings

Access via the **Settings** icon at the bottom of the sidebar.

### General Tab

| Setting | Description |
|---|---|
| Clinic Name | Printed on all invoices |
| Address | Printed on invoices |
| Phone | Printed on invoices |
| Tax Rate | GST % on invoices (e.g., 18) |
| Discount Threshold | Maximum % discount allowed without approval |
| Session Timeout | Auto-logout time in minutes |
| Expiry Alert Days | Warn about medicines expiring within N days |

Click **Save Settings** after making changes.

---

### Chairs Tab

Configure the dental chairs/rooms:
- Add or rename chairs
- Set the **slot size** (minimum booking time in minutes)
- Choose chair type (General / Minor Procedure)

---

### Treatments Tab

Manage the treatment catalogue:
- Add new procedures with default price and duration
- Edit existing prices
- Deactivate treatments that are no longer offered

---

### Audit Log

A complete, tamper-proof log of all actions taken in the system:
- Who did what and when
- Filter by date range, action type, or entity

Only visible to Doctor role.

---

## 17. Backup & Restore

> ⚠ **Regular backups are essential.** The database is stored locally — if the computer fails, data may be lost without a backup.

### Manual Backup

1. Go to **Settings → Backup**.
2. Click **Select Backup Folder** and choose a folder (preferably on an external drive or network share).
3. Click **Backup Now**.
4. A `.zip` file is created in the selected folder with a timestamp.

### Scheduled Backup

1. In **Settings → Backup**, enable **Scheduled Backup**.
2. Set the backup time (default: 11:00 PM).
3. Set how many backup files to retain (default: 7 — older ones are deleted automatically).
4. Click **Save Settings**.

The application must be running at the scheduled time for the backup to occur.

---

### Restoring from Backup

> ⚠ Restoring will **replace all current data** with the backup. This cannot be undone.

1. Go to **Settings → Backup**.
2. Click **Restore from Backup**.
3. Select the `.zip` backup file.
4. Confirm the restore.
5. The application will restart automatically.

---

## 18. User Management

Only the **Doctor** role can manage users.

### Adding a New User

1. **Settings → User Management → + Add User**
2. Enter username, password, and role (Doctor or Receptionist).
3. Click **Save**.

### Changing a Password

1. Find the user in the list.
2. Click **Reset Password**.
3. Enter and confirm the new password.
4. Click **Save**.

### Deactivating a User

If a staff member leaves, deactivate their account instead of deleting:
1. Click the toggle next to their name.
2. Confirm. They will no longer be able to log in.

---

## 19. Frequently Asked Questions

**Q: Can I run this on multiple computers at the same time?**  
A: No. This is a single-computer, offline application. All data is on one machine.

**Q: What happens if I forget my password?**  
A: Another Doctor user can reset your password via User Management. If the only Doctor account is locked out, contact your system administrator for database-level recovery.

**Q: Can I import existing patient data?**  
A: There is no built-in import tool. Patient records must be entered manually, or a developer can bulk-insert from a CSV using the database tools.

**Q: Where is the database file?**  
A: `C:\Users\<YourName>\AppData\Roaming\dental-clinic-manager\clinic.db`  
You can find this path in **Settings → Database → Show DB Location**.

**Q: Can I print directly from the application?**  
A: Yes — invoices generate a PDF that opens in your PDF viewer, from which you can print normally.

**Q: Why is the WhatsApp button not working?**  
A: WhatsApp requires an internet connection and a valid 10-digit mobile number for the patient. Ensure the computer has internet access when using this feature.

**Q: The dental chart is not showing my new treatment.**  
A: Switch to a different tab and back to the Dental Chart tab — the chart refreshes each time you open it. If the treatment uses tooth-specific areas (not "Full Mouth" or "Arch"), it will appear on the chart automatically.

**Q: Can I use this application after a power cut?**  
A: Yes. SQLite is resilient. Upon restart, the application opens the existing database. Enable WAL mode (already on by default) ensures incomplete transactions are rolled back safely.

**Q: How do I handle a patient who owes money across multiple invoices?**  
A: Check the patient's **Billing** tab to see all invoices. Each invoice is paid independently. The Dashboard shows total outstanding.

**Q: Is patient data encrypted?**  
A: The SQLite file is not encrypted at the database level. Protect patient data by:
- Using Windows login passwords
- Enabling disk encryption (Windows BitLocker)
- Restricting physical access to the computer
- Keeping regular off-site backups

---

*For technical support or developer inquiries, refer to `DEVELOPER.md`.*
