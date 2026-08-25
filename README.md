# Healthcare Appointment & Follow-up Manager

A clinic platform with separate portals for **patients**, **doctors**, and an **admin**.
Patients book appointments and share symptoms in advance; doctors get an AI pre-visit
summary before the visit and produce a patient-friendly post-visit summary; both sides
get email confirmations and Google Calendar events.

## Tech Stack

- **Backend:** Node.js, Express, Sequelize (MySQL)
- **Frontend:** React (Vite), React Router, Axios
- **Auth:** JWT, role-based (patient / doctor / admin)
- **LLM:** OpenAI API (pre-visit & post-visit summaries)
- **Email:** Nodemailer (any SMTP provider — Gmail, Mailtrap, SendGrid SMTP, etc.)
- **Calendar:** Google Calendar API via OAuth 2.0
- **Background jobs:** node-cron (slot-hold cleanup, reminders, notification retries)

---

## 1. Project Structure

```
healthcare-appointment-manager/
├── backend/
│   ├── config/db.js            Sequelize/MySQL connection
│   ├── models/                 Sequelize models + associations
│   ├── migrations/schema.sql   Raw SQL schema (source of truth for DB structure)
│   ├── migrations/run.js       Runs schema.sql against MySQL (npm run migrate)
│   ├── controllers/            Route handlers (business logic)
│   ├── routes/                 Express routers
│   ├── middleware/              JWT auth, role guard, error handler
│   ├── services/                LLM, email, email templates, Google Calendar, slot generation
│   ├── jobs/                    Cron jobs (hold cleanup, reminders, retries)
│   └── server.js                App entry point
└── frontend/
    └── src/
        ├── api/client.js        Axios instance with auth interceptor
        ├── context/AuthContext.jsx
        ├── pages/                Login, Register, Patient/Doctor/Admin dashboards, booking flow
        └── components/Navbar.jsx
```

---

## 2. Setup Guide

### Prerequisites
- Node.js 18+
- MySQL 8+
- An OpenAI API key
- An SMTP account (Gmail app password, Mailtrap, or SendGrid SMTP credentials)
- A Google Cloud project with the Calendar API enabled (for calendar sync)

### Backend

```bash
cd backend
cp .env.example .env     # fill in the values, see below
npm install
npm run migrate          # creates the database + all tables from migrations/schema.sql
npm run dev               # starts the API on http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env      # set VITE_API_URL if not using the default
npm install
npm run dev                # starts the app on http://localhost:5173
```

### First admin account

There is no public admin signup (by design — patients self-register, doctors and admins
are provisioned). Insert the first admin directly:

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Clinic Admin', 'admin@clinic.com', '<bcrypt-hash>', 'admin');
```

Generate a bcrypt hash quickly with:
```bash
node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
```

From there, log in as admin and use the Admin portal to create doctor accounts.

---

## 3. Environment Variables (`.env.example`)

See `backend/.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DB_*` | MySQL connection |
| `JWT_SECRET` | Signs auth tokens |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | LLM summaries |
| `SMTP_*`, `EMAIL_FROM` | Email delivery |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Calendar OAuth |
| `SLOT_HOLD_MINUTES` | How long a slot is reserved while a patient fills the symptom form |

---

## 4. Database Schema

Full DDL lives in `backend/migrations/schema.sql`. Summary:

- **users** — all accounts (patient/doctor/admin), role-based.
- **doctor_profiles** — 1:1 with a doctor user; specialization, `working_hours` (JSON per
  weekday), `slot_duration_minutes`.
- **doctor_leaves** — dates a doctor is unavailable.
- **slots** — every bookable time slot is a pre-generated row
  (`open` / `held` / `booked` / `blocked`). This is what makes conflict-free booking possible
  (see System Design doc).
- **appointments** — one row per booking; stores symptom text, the AI pre-visit summary
  (JSON), doctor notes, prescription (JSON), the AI post-visit summary, and both parties'
  Google Calendar event ids.
- **medication_reminders** — generated from the prescription after the visit; drives the
  medication reminder cron job.
- **notifications** — every email sent is logged here with `status` and `retry_count`, so
  failures can be retried without re-triggering the business action that caused them.
- **calendar_tokens** — per-user Google OAuth tokens (refreshed automatically).

---

## 5. API Overview

All routes are prefixed `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Patient self-registration |
| POST | `/auth/login` | public | Login (any role) |
| GET | `/auth/me` | any | Current user |
| GET | `/doctors` | any | Search doctors, `?specialization=` |
| GET | `/doctors/:id/slots` | any | Open slots for a doctor, `?from=&to=` |
| POST | `/appointments/hold` | patient | Hold a slot (`{slotId}`) |
| POST | `/appointments/confirm` | patient | Confirm booking (`{slotId, symptomText}`) — triggers pre-visit LLM summary, emails, calendar events |
| GET | `/appointments/mine` | any | My appointments (role-aware) |
| POST | `/appointments/:id/cancel` | owner/doctor/admin | Cancel; releases the slot, deletes calendar events, emails both sides |
| POST | `/appointments/:id/post-visit` | doctor | Submit notes + prescription — triggers post-visit LLM summary and medication reminders |
| POST | `/admin/doctors` | admin | Create a doctor (user + profile), pre-generates 30 days of slots |
| GET | `/admin/doctors` | admin | List doctors |
| PUT | `/admin/doctors/:id` | admin | Update profile / working hours / slot duration |
| POST | `/admin/doctors/:id/leave` | admin | Mark a leave day — cancels affected bookings & notifies patients |
| GET | `/admin/patients` | admin | List patients |
| GET | `/admin/appointments` | admin | All appointments |
| GET | `/calendar/oauth/connect` | any | Returns Google consent URL |
| GET | `/calendar/oauth/callback` | — | OAuth redirect target (called by Google) |

---

## 6. LLM Prompts

Both prompts are implemented exactly as specified, in `backend/services/llmService.js`:

**Pre-visit summary** (on booking confirmation):
> "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint,
> and three suggested questions for the doctor. Symptoms: `<symptoms>`"

The model is asked to return strict JSON (`urgency_level`, `chief_complaint`,
`suggested_questions[]`) so it can be stored and rendered directly in the doctor's view.

**Post-visit summary** (after the doctor submits notes + prescription):
> "Convert these clinical notes into a patient-friendly summary with medication schedule and
> follow-up steps: `<notes>`"

**Failure handling:** every LLM call is wrapped in try/catch and never throws. Each
appointment stores `pre_visit_llm_status` / `post_visit_llm_status` (`pending` / `success` /
`failed`). On failure, the booking or the post-visit submission still succeeds — the doctor
sees "AI summary unavailable, review manually" instead of the app breaking.

---

## 7. Google Calendar Setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable
   the **Google Calendar API**.
2. Configure the OAuth consent screen (External is fine for testing; add your test users'
   emails while the app is unverified).
3. Create an **OAuth 2.0 Client ID** (Web application).
   - Authorized redirect URI: `http://localhost:5000/api/calendar/oauth/callback`
     (match `GOOGLE_REDIRECT_URI` in `.env`, and update it to your deployed backend URL in
     production).
4. Copy the Client ID and Client Secret into `backend/.env`.
5. In the app, a logged-in patient or doctor clicks **"Connect Google Calendar"**, is sent to
   Google's consent screen, and is redirected back to `/calendar-connected` on the frontend.
   Tokens are stored in the `calendar_tokens` table and refreshed automatically.
6. From then on, every booking/cancellation creates/deletes an event on that user's primary
   calendar. Calendar failures are logged but never block the appointment action itself.

---

## 8. Deliverables Checklist

- [x] Complete source code (this repository)
- [x] `README.md` with setup guide, `.env.example`, API docs, DB schema, LLM prompts, Google
      Calendar setup
- [ ] Hosted application URL — deploy `backend/` (Render/Railway) and `frontend/` (Vercel),
      set `VITE_API_URL` to the deployed backend and `CLIENT_URL` on the backend to the
      deployed frontend origin
- [x] `SYSTEM_DESIGN.md` — double-booking prevention, doctor leave conflict handling, slot
      hold mechanism, notification failure handling

      Doctor Credentials: charushama2005@gmail.com
      pswd: Hello@1234
