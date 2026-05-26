# Finvera

Finvera is an AI-powered personal finance platform built with Next.js, Prisma, PostgreSQL, and NextAuth. The current codebase focuses on the foundation layer: secure authentication, user-scoped data models, protected routes, and the core finance database schema needed for transactions and budgets.

## Tech Stack

- Frontend: Next.js App Router + React + Tailwind CSS
- Backend: Next.js route handlers
- Database: PostgreSQL
- ORM: Prisma
- Authentication: NextAuth with credentials login
- Validation: Zod
- Password hashing: bcryptjs

## Current Features

- Email and password registration
- Email and password sign-in
- Protected dashboard, transactions, and budgets routes
- Current-user profile API at `/api/users/me`
- Prisma models for users, categories, transactions, and budgets
- Responsive UI foundation with a finance-focused visual design
- Deterministic financial snapshot and narrative layers for dashboard interpretation

## Project Structure

- `src/app/page.tsx` public landing page
- `src/app/(auth)` authentication routes and layout
- `src/app/(protected)` authenticated app shell and product routes
- `src/app/api/auth` NextAuth and registration routes
- `src/app/api/users/me` current-user API
- `src/lib/financial-snapshot.ts` canonical financial snapshot builder and metrics
- `src/lib/narrative.ts` deterministic snapshot-to-narrative interpreter
- `src/lib` Prisma client, auth config, password helpers, and schema validators
- `prisma/schema.prisma` database schema

## Routes

- `/` public landing page
- `/register` create an account
- `/login` sign in
- `/dashboard` authenticated overview
- `/transactions` transaction list
- `/budgets` budget overview
- `/api/users/me` read or update the current user profile

## Setup

1. Install dependencies.

```bash
npm install
```

1. Create a local environment file from the example.

```bash
cp .env.example .env
```

1. Set a real PostgreSQL connection string in `DATABASE_URL` and generate a secure `NEXTAUTH_SECRET`.

1. Push the Prisma schema to your database.

```bash
npm run prisma:generate
npm run prisma:migrate
```

1. Start the development server.

```bash
npm run dev
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Base URL for authentication callbacks
- `NEXTAUTH_SECRET`: Secret used to sign sessions and tokens

## Database Model

- `User`: authenticated account record with hashed password storage
- `Category`: user-owned transaction grouping with color and type metadata
- `Transaction`: income and expense records scoped to a user
- `Budget`: category-level budget records scoped to a user and period

## Notes

- The app currently uses NextAuth credentials auth so it can run without a third-party identity provider.
- Protected routes are enforced with middleware and server-side session checks.
- The schema is intentionally user-scoped so transactions, budgets, and future AI features can never leak across accounts.
- Dashboard behavior now follows a deterministic pipeline: transactions feed a canonical `FinancialSnapshot`, and the snapshot is then interpreted into a separate `FinancialNarrative`.
- Narrative copy is intentionally observational rather than advisory so the system explains patterns without pretending to prescribe actions.

## Next Milestones

- Transaction creation and editing flows
- Category management
- Budget creation and tracking
- CSV import and export
- Temporal context for the snapshot layer, including month-over-month deltas and rolling averages
- Narrative smoothing and anomaly detection
