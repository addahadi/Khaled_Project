# DiagInfect — AI Infectious Disease Diagnosis Platform

Full-stack TypeScript platform connecting doctors, lab technicians, and hospital managers
with an AI pipeline for infectious disease risk assessment.

---

## Tech Stack

| Layer     | Stack                                                          |
|-----------|----------------------------------------------------------------|
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Axios    |
| Backend   | Node.js, Express, TypeScript, Zod, JWT, postgres.js           |
| Database  | Supabase (PostgreSQL) — raw SQL only, no Supabase client SDK  |
| AI        | Pluggable AIService (mock by default, swap with any ML endpoint)|
| Email     | Resend (falls back to console.log if key not set)             |

---

## Project Structure

```
diaginfect/
├── backend/               Express API
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/db.ts              Supabase raw SQL connection
│   │   ├── utils/                    AppError, catchAsync
│   │   ├── middleware/               authenticate, requireRole,
│   │   │                             checkSubscription, errorHandler
│   │   ├── services/                 aiService, emailService
│   │   ├── controllers/              auth, plan, subscription, org,
│   │   │                             invitation, doctor, lab, manager
│   │   └── routes/                   one file per domain
│   ├── migration_clean.sql            refresh_tokens, token_blacklist (all on users table)
│   ├──               invitations, overage_events, feature_explanations
│   ├── package.json
│   └── .env.example
│
└── frontend/              React SPA
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx                   All routes
    │   ├── index.css                 Tailwind + shadcn CSS variables
    │   ├── lib/utils.ts              cn() helper
    │   ├── api/                      apiClient, ApiManager, translations,
    │   │                             queryClientSetup, useDelayedLoading
    │   ├── contexts/AuthContext.tsx
    │   ├── components/
    │   │   ├── NavLink.tsx
    │   │   ├── auth/                 ProtectedRoute, UpgradePrompt
    │   │   ├── doctor/DoctorLayout
    │   │   ├── lab/LabLayout
    │   │   ├── manager/              ManagerLayout, InviteStaffDialog
    │   │   └── public/PublicNavbar
    │   └── pages/
    │       ├── auth/                 Login, Register, RegisterOrganization,
    │       │                         ActivateAccount
    │       ├── public/               Landing, About
    │       ├── doctor/               Dashboard, Patients, PatientDetail,
    │       │                         NewPrediction, PredictionHistory, Profile
    │       ├── lab/                  LabDashboard, LabOrders, EnterResults
    │       └── manager/              ManagerDashboard, Staff, Subscription,
    │                                 Reports, Profile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── components.json
```

---

## Quick Start

### 1. Database

```bash
# Run in order against your Supabase DB
psql $DATABASE_URL < backend/migration_clean.sql
psql $DATABASE_URL < backend/
# Your original schema.sql must have already been run first
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CLIENT_URL
npm install
npm run dev          # Starts on http://localhost:3001
```

**Required `.env` variables:**

| Variable               | Description                                         |
|------------------------|-----------------------------------------------------|
| `DATABASE_URL`         | `postgresql://postgres:[pw]@db.[ref].supabase.co/postgres` |
| `JWT_ACCESS_SECRET`    | Min 32-char random string                           |
| `JWT_REFRESH_SECRET`   | Min 32-char random string (different from above)    |
| `CLIENT_URL`           | `http://localhost:5173`                             |
| `AI_SERVICE_URL`       | Optional — ML service URL. Mock used if absent.     |
| `RESEND_API_KEY`       | Optional — Resend key. console.log used if absent.  |
| `FROM_EMAIL`           | Optional — e.g. `DiagInfect <no-reply@yourdomain.com>` |

### 3. Frontend

```bash
cd frontend
npm install

# Install shadcn/ui components
npx shadcn-ui@latest init        # Accept defaults, pick blue theme
npx shadcn-ui@latest add card badge button input label select table \
  skeleton progress dialog dropdown-menu avatar sidebar toaster \
  toast sheet tabs separator

npm run dev          # Starts on http://localhost:5173
```

---

## User Flows

### Self-service onboarding (Hospital Manager)
1. Visit `/register-organization`
2. Fill in org name + type + admin account details
3. Backend creates: **Organization → Trial Subscription → auth_user → User → hospital_managers**
4. Sign in at `/login` → land on `/manager/dashboard`
5. Create departments at `/manager/staff` → click **Invite Staff**
6. Staff receive email with link `/activate/:token`
7. Staff set username + password → account activated → redirected to their dashboard

### Doctor prediction workflow
1. Register patient → `/doctor/patients`
2. Record vitals + symptoms via **Add Vitals**
3. Order lab tests via **Order Lab**
4. Lab tech processes tests + enters results
5. Doctor runs prediction: `/doctor/predictions/new`
6. Backend: fetches clinical data → fetches lab results → calls AIService → saves result + XAI
7. Doctor sees risk score + XAI feature explanations in `/doctor/predictions`

### Subscription limits
- **Trial + limit hit** → `402` → upgrade prompt shown
- **Paid + over limit** → overage incremented → prediction proceeds + overage badge shown
- Manager upgrades at `/manager/subscription` using `plan_id` (never `id`)

---

## API Reference

```
POST   /api/organizations           Register org + trial sub + manager
POST   /api/auth/register           Individual user registration
POST   /api/auth/login              Login → access token + refresh cookie
POST   /api/auth/refresh            Silent refresh
POST   /api/auth/logout             Revoke tokens
GET    /api/auth/me                 Current user profile

GET    /api/plans                   List active plans
GET    /api/plans/:planId           Single plan

GET    /api/subscriptions/my        Current org subscription
GET    /api/subscriptions/usage     Current cycle usage
POST   /api/subscriptions           Create subscription
PATCH  /api/subscriptions/change-plan  Switch plan

GET    /api/invitations             List org invitations
POST   /api/invitations             Invite staff (+ user limit check)
PATCH  /api/invitations/activate/:token  Activate account
DELETE /api/invitations/:id         Cancel invitation

GET    /api/doctor/patients         Patient list
POST   /api/doctor/patients         Register patient
GET    /api/doctor/patients/:id     Patient detail + history
POST   /api/doctor/clinical-data    Record vitals + symptoms
POST   /api/doctor/lab-orders       Order lab test
GET    /api/doctor/predictions      Prediction history
POST   /api/doctor/predictions      Run AI prediction (limit-checked)
GET    /api/doctor/predictions/:id  Detail + XAI explanations
GET    /api/doctor/alerts           Alerts
PATCH  /api/doctor/alerts/:id/read  Mark alert read

GET    /api/lab/stats               Lab dashboard stats
GET    /api/lab/orders              All orders
GET    /api/lab/orders/:id          Order detail + results
PATCH  /api/lab/orders/:id/start    Mark in-progress
POST   /api/lab/results             Submit results + alert doctor

GET    /api/manager/organization    Org + departments
GET    /api/manager/departments     Department list
POST   /api/manager/departments     Create department
GET    /api/manager/staff           Staff list
PATCH  /api/manager/staff/:id/status  Update status
GET    /api/manager/reports         30-day analytics
```
