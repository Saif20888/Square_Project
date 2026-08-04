# SQUARE Group — IT Operations Portal

Internal portal for IT asset custody, repair tickets and hardware lifecycle
management: one place to raise a problem, track who is fixing it, and know
which device is with which employee.

**Stack:** Spring Boot 4.1 (Java 21) · PostgreSQL · Flyway · React 18 · Vite · Tailwind

---

## What it does

Four roles, each with its own dashboard:

| Role | Shown as | Can do |
| --- | --- | --- |
| `EMPLOYEE` | User | Raise tickets, register and view their own devices |
| `IT_TECH` | IT Team | Work tickets, run the asset lifecycle — assign, loan, repair, warranty replace, scrap |
| `SUPERVISOR` | Superuser | Onboarding, offboarding, org structure, password resets, spreadsheet import, audit trail |
| `SYSTEM_ADMIN` | System admin | Oversight and system health |

Tickets carry a cascading intake form (office → floor → department → problem
type). Assets move through a full lifecycle with depreciation and warranty
tracking. Employees can be onboarded individually or imported from a
spreadsheet.

---

## Running it locally

**Requirements:** Java 21, Node 20, PostgreSQL 16, a database named `square_db`.

### Backend

Database credentials are never stored in this repository. Create
`square-backend/config/application.yaml` — this path is gitignored and Spring
Boot loads it automatically:

```yaml
spring:
  datasource:
    password: your-local-postgres-password

# Password given to the demo accounts the first time an empty database is seeded
DEMO_PASSWORD: choose-something
```

Then:

```bash
cd square-backend
./mvnw spring-boot:run
```

Flyway builds the schema on first run. The demo accounts (`admin1`,
`manager1`, `tech1`, `saif`, `raihan`, …) are created with your
`DEMO_PASSWORD`; if you leave it unset, a random one is generated and printed
to the console. Nothing sign-in-able is stored in source.

### Frontend

```bash
cd square-frontend
npm install
npm run dev
```

Runs on port 5173, which the backend's CORS expects. If another dev server
holds that port, Vite fails loudly rather than drifting to 5174 and being
silently blocked.

### Tests

```bash
cd square-backend && ./mvnw test
```

30 tests, running on in-memory H2 — no database needed.

---

## How security works

- **Passwords** are BCrypt hashed. Five wrong attempts lock an account for ten
  minutes, and sign-ins are rate limited per address on top of that.
- **Sessions** are bearer tokens with a twelve-hour lifetime, swept on a
  schedule and revoked entirely when a password changes.
- **Authorization** is enforced on the server by `@RequiresRole` and
  `RoleInterceptor` — never only in the UI, which anyone can bypass with a
  browser console. Profile edits are self-only, and designation, department
  and unit can only be changed by a Superuser, so nobody can promote
  themselves.
- **An audit trail** records password resets, onboarding, asset scrap and
  assign, and organization changes, taking the actor from the session rather
  than from the request body.
- **Errors** never return stack traces.

## How configuration works

Every secret comes from the environment. The `prod` profile has no fallback
values at all, so a missing variable stops the application instead of letting
it start on a development password. Flyway owns the schema; Hibernate is set
to `validate` and never alters a table. Demo seed data and the frontend's
offline demo fallback are development-only.

See [DEPLOYMENT.md](DEPLOYMENT.md) for production configuration, the first-run
sequence, and known limitations.

---

## Note on the sample data

Everything in this repository is fabricated. The seeded employees, the
spreadsheets under `square-frontend/public/`, the tickets and the asset
records are all invented for demonstration, and no real personal data is
included.
