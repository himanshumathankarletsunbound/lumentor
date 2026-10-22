# LUmentor - Operations, Scheduling & Mentor Payroll System

A high-performance SaaS management platform built for tutoring and education businesses that use **Classcard** as their operational data source.

This system provides a unified operational and financial layer: bi-directional synchronisation with Classcard Public API v2, role-based access control (RBAC), multi-view unified calendar, attendance marking, an anti-tamper multi-model mentor payroll calculation engine, dispute and penalty management, and audit logging.

All monetary values in the application are denominated and displayed in Indian rupees (INR/₹), including payroll, penalties, incentives, packages, invoices, payments, and payslips. Legacy records carrying a USD currency tag are normalized to INR for display.

---

## 🌟 Key Features

### 1. Classcard Public API v2 Integration
- **Gateway**: Integrates directly with Classcard's Public API v2 (`https://api.classcardapp.com/api/v2/public/`).
- **Security**: The API key is securely stored server-side. Frontend requests only receive a masked representation (e.g. `sk_live_••••••••xyz9`).
- **Endpoint Matrix**: Covers all 27 documented endpoints across Students, Leads, Staff, Invoices, Payments, Enrolments, Categories/Items, Coupons/Events, Attendance, Credit Notes, and Guardians.
- **Idempotent Sync**: Ingests students, staff/mentors, classes/events, invoices, and attendance without duplicate creations via external ID and email upserts.
- **Resilience**: Automatic retry with exponential backoff, circuit-breaker awareness, timeout handling, empty-body HTTP 200/204 response normalization, and full provenance tagging (`CLASSCARD_SOURCED`).
- **Sandbox Fallback**: Built-in mock/sandbox mode allows full end-to-end testing and demo operations even when external credentials are not yet provisioned.

### 2. Fine-Grained Role-Based Access Control (RBAC)
- **Personas Supported**:
  - **Administrator**: Complete control over system configuration, user/role permissions, Classcard credentials, payroll locking, approvals, and audit trails.
  - **Operations Specialist**: Day-to-day scheduling, calendar overview, attendance exceptions, class completion, and penalty recording (with anti-self-approval protection).
  - **Mentor**: Isolated personal portal showing only their assigned classes, calendar, attendance records, earnings breakdown, penalties, disputes, and finalized payslips.
  - **Custom Roles**: Configurable permissions by module (View, Create, Edit, Delete, Approve, Export, Manage Settings, View Sensitive Payroll) with optional branch-level scoping.
- **Interactive Persona Switcher**: Instantly switch roles and branches in the UI header to audit permissions, views, and authorization enforcement in real time.

### 3. Unified Operations Calendar
- **Views**: Month, Week, Day, and Agenda list views.
- **Filters**: Filter by Branch, Subject, Mentor, Class Status (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `LATE_CANCELLED`), and Attendance Status.
- **Interactive Event Modal**: View student rosters, class details, source provenance, and mark/update attendance directly in the calendar.

### 4. Configurable Multi-Model Payroll Engine
Calculates mentor compensations with precision arithmetic (2 decimal places) across six distinct models:
1. **Per-Class Rate**: Fixed fee per completed class session.
2. **Duration-Based (Hourly)**: Compensation proportional to session duration with custom rounding intervals and minimum duration thresholds.
3. **Per-Student Rate**: Scaled by the number of students marked `PRESENT` or `LATE`.
4. **Fixed Monthly Salary**: Prorated or flat recurring base retainer.
5. **Percentage-Based (Revenue Share)**: Commission tied to invoice or enrolled package value.
6. **Hybrid**: Base retainer plus tiered per-class or duration bonuses.

- **Immutability & Plan Versioning**: Historical payroll batches freeze the active plan version snapshot. Future rate or policy adjustments will never silently mutate past paid cycles.
- **Late Cancellation Compensation**: Configurable rules to compensate mentors when students cancel late.
- **Separation of Concerns**: Calculating, Approving, Locking, and Payment Confirmation are separate, sequential state transitions.

### 5. Penalties, Adjustments & Anti-Tamper Workflow
- **Four-Eyes Principle / Anti-Self-Approval**: Operations staff cannot approve penalties they submitted.
- **Deduction Safety**: Only `APPROVED` penalties reduce payable amounts. Draft or pending submitted penalties are quarantined.
- **Audit Logging & Reversal**: Deletion is prohibited on approved penalties; authorized reversals create credit adjustment records with mandatory justification reasons.
- **Mentor Dispute Flow**: Mentors can flag deductions or discrepancies directly from their dashboard.

### 6. Official Finalized Payslips
- Formatted for print or PDF export.
- Itemizes earnings, bonuses, approved penalties, tax withholdings, and net payable amounts.
- Includes signature lines, generated date stamps, and encrypted verification hash.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16.4.2](https://nextjs.org/) (App Router, Turbopack, Partial Prerendering)
- **Runtime**: Node.js v24.14+ / pnpm v11.5+
- **UI Library**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Utilities**: [date-fns](https://date-fns.org/)
- **Database Schema**: [Prisma ORM](https://www.prisma.io/) (`prisma/schema.prisma` targeting PostgreSQL)
- **Production Persistence Layer**: PostgreSQL through Prisma. The server store hydrates from and persists to PostgreSQL `AppState`; encrypted credentials use `EncryptedSecret`.
- **Local/test persistence (explicit opt-in only)**: Atomic JSON storage can be enabled with `DEMO_MODE=true`; it is never used by production deployments and no fabricated records are created by normal startup.

---

## 📁 Project Structure

```
.
├── prisma/
│   └── schema.prisma           # Complete PostgreSQL schema (Users, Roles, Branches, Mentors, Payroll, etc.)
├── src/
│   ├── app/                    # Next.js App Router (41 routes)
│   │   ├── admin/              # User/role management, Classcard API settings, audit logs, system config
│   │   ├── analytics/          # Attendance, class utilization, mentor/branch performance, sync reports
│   │   ├── api/                # Classcard sync, status, test connection, payroll processing & penalties
│   │   ├── finance/            # Payroll dashboard, rules editor, processing, penalties, payslips, reports
│   │   ├── operations/         # Calendar, classes, attendance roster, exceptions, mentors, students
│   │   └── overview/           # Executive, Operations, and Mentor dashboards
│   ├── components/
│   │   ├── calendar/           # UnifiedCalendar, CalendarFilterBar, CalendarEventModal
│   │   ├── charts/             # SVG BarChart and DonutChart
│   │   ├── classcard/          # SyncStatusCard, EndpointMatrix (27 endpoints), SyncHistoryTable
│   │   ├── layout/             # AppShell, Sidebar, Header, RoleSwitcher
│   │   ├── payroll/            # PayslipViewer, PenaltyModal
│   │   └── ui/                 # Button, Badge, Card, StatCard, Modal, Drawer, Tabs, Alert, Table
│   └── lib/
│       ├── auth/               # AuthContext, permissions matrix, RBAC utilities
│       ├── db/                 # Transactional atomic store, seed data
│       ├── integrations/       # Classcard client, sync orchestrator, endpoint types
│       ├── payroll/            # Multi-model compensation engine, rule evaluator
│       └── types/              # Comprehensive TypeScript interfaces
└── tests/
    └── acceptance.test.ts      # 18 automated acceptance & security scenarios
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v20.0.0` or higher (tested on Node v24.14.0)
- pnpm `v9.0.0` or higher (tested on pnpm v11.5.3)

### 1. Installation
Clone repository and install dependencies:
```bash
git clone <repository-url>
cd LUmentor
pnpm install
```

### 2. Environment Configuration

Copy [`.env.example`](./.env.example) to a server-only environment file. Never expose secrets through `NEXT_PUBLIC_*` variables. Production requires PostgreSQL, live Classcard credentials, an application encryption key, and a Google Workspace OAuth connection; simulated integrations are only available with explicit `DEMO_MODE=true`.
Create a `.env.local` file in the root directory (optional, mock mode will activate automatically if unset):
```env
# Classcard Public API v2 Credentials
CLASSCARD_API_KEY=your_classcard_api_key_here
CLASSCARD_API_BASE_URL=https://api.classcardapp.com/api/v2/public/

# Database (for production PostgreSQL deployment via Prisma)
APP_ENCRYPTION_KEY="generate-a-long-random-secret"

# Gmail OAuth (server-only)
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI="https://your-domain.example/api/settings/email/oauth/callback"
DATABASE_URL="postgresql://user:password@localhost:5432/mva_operations?schema=public"
```

### 3. Run Development Server
Start the Next.js development server with Turbopack:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The application will automatically route based on the selected persona (Executive Dashboard by default).

### 4. Build for Production
Create an optimized production build:
```bash
pnpm build
```
Start the production server:
```bash
pnpm start
```

---

## 🧪 Automated Testing & Verification

The project includes an acceptance test suite (`tests/acceptance.test.ts`) that verifies 18 critical scenarios:
```bash
pnpm test
```

### Verified Scenarios:
1. **Scenario 1**: Classcard credentials are kept secure and masked for client visibility (`sk_live_••••••••xyz9`).
2. **Scenario 2**: Connection test verifies status against live gateway or sandbox fallback.
3. **Scenario 3**: Supported Classcard records synchronize idempotently without duplicate records.
4. **Scenario 4**: Safe handling of empty body HTTP 200/204 endpoints and response normalization.
5. **Scenario 5**: RBAC enforcement: Users see only authorized modules and actions.
6. **Scenario 6**: Administrator configuration of branches, subjects, and packages with proper schemas.
7. **Scenario 7**: Calendar filters dynamically update events and status summaries.
8. **Scenario 8**: Attendance marking updates student roster and computes class completion status.
9. **Scenario 9**: Multi-model mentor payroll configuration (all 6 models supported).
10. **Scenario 10**: Reproducible payroll calculations preserving frozen plan version snapshots.
11. **Scenario 11**: Quarantined penalties (`SUBMITTED`/`DRAFT`) do NOT reduce payable amounts.
12. **Scenario 12**: Approved penalties are applied once and flagged to prevent double-deduction.
13. **Scenario 13**: Anti-self-approval rule: Operations specialists cannot approve their own submitted penalties.
14. **Scenario 14**: Authorized reversal replaces silent deletion and logs audit rationale.
15. **Scenario 15**: Mentor isolation: Mentors access only their own payroll, penalties, and payslips.
16. **Scenario 16**: Strict separation between Payroll Approval and Payment Confirmation states.
17. **Scenario 17**: Decimal monetary precision arithmetic prevents floating-point rounding errors.
18. **Scenario 18**: Persistent audit logging records all sensitive administrative and financial actions.

---

## 🗄️ Database & Production Deployment Path

### Persistence modes:
- **Production**: `DEMO_MODE=false` and a valid `DATABASE_URL`. Prisma loads and persists application state in PostgreSQL. `data/db.json` is not read or written.
- **Local/tests**: `DEMO_MODE=true` is an explicit opt-in for isolated tests that cannot provision PostgreSQL. The JSON store starts empty; application records must be created through the same APIs used in production.
- `APP_ENCRYPTION_KEY` is required for encrypted OAuth refresh-token storage. Never reuse a development key in production.

### Migrating to Production PostgreSQL:
1. Review the Prisma schema in [`prisma/schema.prisma`](file:///Users/himanshumathankar/Developer/LUmentor/prisma/schema.prisma), which defines full models for:
   - `User`, `Role`, `AuditLog`
   - `Branch`, `Subject`, `Package`
   - `Mentor`, `PayrollPlan`, `PayrollBatch`, `Payslip`, `Penalty`
   - `Student`, `ClassSession`, `AttendanceRecord`
   - `ClasscardSyncLog`, `Invoice`, `Payment`
2. Connect to your PostgreSQL instance in `.env`:
   ```bash
   DATABASE_URL="postgresql://username:password@db.yourhost.com:5432/production_db?schema=public"
   ```
3. Run the checked-in Prisma migrations:
   ```bash
   pnpm db:migrate
   ```
4. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```

---

## 📄 License
Internal proprietary license for education and tutoring business operations. All rights reserved.

## Production deployment requirements

Production deployments use PostgreSQL through Prisma. Set `DATABASE_URL` to the pooled Neon runtime URL and `DIRECT_DATABASE_URL` to Neon’s direct (non-pooler) connection URL in Vercel **Production** and **Preview** as appropriate. Prisma migrations use `DIRECT_DATABASE_URL` because pooled endpoints can time out while acquiring Prisma’s advisory lock; runtime queries continue to use `DATABASE_URL`. The production build automatically runs `prisma migrate deploy` before `next build`, retrying once after a transient lock timeout. Do not expose either variable through a `NEXT_PUBLIC_*` variable. For a manual migration, run `pnpm db:migrate` locally with the same server-only migration URL.

Set `CLASSCARD_API_KEY` only on the server. Live synchronization sends this key only in the server-side `api-key` header; it is never persisted in the application store or returned to browser code.

### Importing a Classcard staff CSV

The **Operations → Mentors & Instructional Staff** page supports **Import staff CSV**. Upload a CSV with `Name`, `Role`, `Phone`, and `Email` columns, such as the Classcard staff export. The import runs through the authenticated server API, creates or updates mentors by unique email, and commits the records to PostgreSQL before reporting success. Duplicate rows with the same email are collapsed because mentor email addresses are unique. A campus branch and payroll plan must exist before importing.

The documented Classcard endpoints currently integrated are:

- `POST /api/classcard/leads` for `POST /api/v2/public/leads/add`
- `GET /api/classcard/staff/:staffId/one-on-one-services` for `GET /api/public/staff/one-on-one-services`
- `GET /api/classcard/inventory` for `GET /api/v2/public/inventory/products`

Inventory ordering is allow-listed to `product_id`, `name`, or `status`, and the documented empty response from lead creation is treated as a valid successful response when Classcard returns a successful status.

Email is outbound-only through Google Workspace OAuth. There is no SMTP-password, app-password, IMAP, POP3, or incoming-mail integration. Set `GOOGLE_OAUTH_CLIENT_SECRET` only on the server; the OAuth refresh token is stored encrypted in PostgreSQL after authorization. `EMAIL_OAUTH_CLIENT_SECRET` is obsolete and ignored. In production, missing or invalid email configuration is an explicit failure, not a simulated success.

### Gmail OAuth

Configure a Google OAuth Web application with the exact callback URL in `GOOGLE_OAUTH_REDIRECT_URI`, then set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `APP_ENCRYPTION_KEY` on the server. In **Admin → Settings → Email**, enter the Google Workspace sender address and select **Connect Google Workspace**. The callback exchanges the authorization code server-side and stores only an AES-256-GCM encrypted refresh token in PostgreSQL; it is never sent to browser code or written to JSON. The account must grant the `https://mail.google.com/` scope. Run the outbound test after connecting and enabling email. LUmentor never reads incoming mail.

`DEMO_MODE=true` is restricted to local acceptance tests. Production must use `DEMO_MODE=false`; production startup requires PostgreSQL and does not seed users, mentors, students, plans, penalties, classes, or policies.

Protected API routes validate the HTTP-only session cookie or bearer token, enforce session expiry and account status, and apply server-side role permissions. Client `localStorage` is not an authentication source. Run `pnpm test:api-auth` to verify unauthenticated and expired-session behavior.
