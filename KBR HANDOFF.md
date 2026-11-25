# Khan Burger & Restaurant – Project Handoff

Date: 2026-11-22
Project folder (Windows): C:\Users\DELL\Downloads\kbr

Use this file in any new chat (paste it at the top) so the next helper knows the project without re-reading everything.

---

## 1. Stack

- Next.js 16.4.6 (App Router). Route protection is in `src/proxy.ts`.
- React 19, TypeScript (strict), Tailwind v4, Zod v4, lucide-react, recharts.
- Prisma 6.19.3 with PostgreSQL 16 in Docker (container `kbr_postgres`, DB `khan_burger`, user `kbr_user`, port 5432).
- Argon2id passwords, DB sessions, cookie `kbr_session`.
- Windows + PowerShell.

## 2. Daily commands

```powershell
cd C:\Users\DELL\Downloads\kbr
docker compose up -d
npm run dev
```

Schema change ke baad (dev server pehle band karein):

```powershell
taskkill /IM node.exe /F
npx prisma validate
npx prisma migrate dev --name <short_name>
npx prisma generate
```

Checks (har batch ke baad):

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

Permission scripts (ek baar ya jab naye permission add hon):

```powershell
npx tsx scripts/grant-finance-permissions.ts
npx tsx scripts/grant-employee-permissions.ts   # Batch 1 ke baad
```

Outbox worker (alag window):

```powershell
npm run worker
```

## 3. Folder map (from your `src` tree)

| Folder | What is inside |
|---|---|
| `src/app/` | Pages (`page.tsx`) and API routes (`api/**/route.ts`) |
| `src/app/admin/` | Admin pages: menu, users, roles, employees, cancellations |
| `src/app/dashboard/` | Dark dashboard (`page.tsx`, `charts.tsx`). `page.backup.tsx` is old. |
| `src/app/pos/` | Cashier POS (`page.tsx`, `pos-client.tsx`) |
| `src/app/kitchen/` | Kitchen board (old design) |
| `src/app/menu/` | Public menu |
| `src/app/login/` | Login page |
| `src/app/api/` | All APIs: admin, approvals, auth, cash, complaints, delivery, employees, expenses, inventory, kitchen, orders, public, purchases, recipes, reports |
| `src/components/app-shell/` | Sidebar and header (dark) |
| `src/components/ui/` | Small UI parts: stat card, badge, empty state, skeleton |
| `src/lib/` | `db.ts` (Prisma client), `env.ts`, `http.ts` (error helper) |
| `src/modules/` | Business logic. Routes call these; they do not hold logic. |
| `src/modules/access-control/` | Permission and branch checks |
| `src/modules/auth/` | Login, session, password, rate limit |
| `src/modules/orders/`, `kitchen/`, `payments/`, `cash/` | Orders, kitchen flow, payments, cash shifts |
| `src/modules/inventory/`, `recipes/` | Stock ledger, stock lock, recipe versions, wastage |
| `src/modules/finance/`, `reports/` | Purchases, expenses, daily report, day close |
| `src/modules/operations/` | Complaints, delivery |
| `src/modules/employees/` | Employee service and schemas |
| `src/modules/pos/`, `menu-codes/`, `public/` | POS catalog, item codes, public menu |
| `src/modules/admin/` | Admin menu, roles, users services |
| `src/modules/approvals/`, `audit/`, `outbox/` | Cancellation approvals, audit log, notifications queue |
| `src/server/worker.ts` | Outbox worker |
| `src/migrations/` | **Check this.** Prisma migrations belong in `prisma\migrations`. |
| `prisma\schema.prisma` | Database schema |
| `scripts\` | Seed and grant scripts |

## 4. Status by area (honest)

| Area | Status | Notes |
|---|---|---|
| Login, logout, lock, rate limit | Done | Tested earlier |
| Catalog and public menu | Done | Owner must verify real prices |
| Orders and kitchen API | Done | Kitchen UI still old design |
| POS | Built | Browser test pending |
| Approvals (cancel) | Done | Tested |
| Cash shifts and cash payments | Done | Other methods (JazzCash, Easypaisa, bank, card) not built |
| Inventory and stock lock | Done | Parallel test result not reported |
| Recipe versions and wastage | Partial | Version 2 check and cancel-wastage test not confirmed |
| Purchases, expenses, daily report and close | Done | Confirmed working |
| Complaints | Built | Test not reported |
| Delivery | Built | Not linked to order status; rider is free text |
| Employees (Batch 17) | Built | Test not reported |
| Employee profile extension (Batch 1 of workforce spec) | Not confirmed | Schema + 22 permissions script written |
| Item codes (Phase 1) | In progress | Schema, migration, service, routes written; test pending |
| Admin pages (users, roles, menu, employees, cancellations) | Present in tree | Not reviewed in this chat |
| Dark dashboard | Built | Build not confirmed |
| Automated tests | Some `.test.ts` files exist | Check `package.json` for a test script; if none, add Vitest |
| Attendance, activity, warnings, performance, salary ledger | Not started | Workforce spec Batches 4–9 |
| Legacy software migration | Not started | Needs legacy software name and export |
| Public website (beyond menu) | Not started | |
| Production hardening | Not started | See section 5 |

## 5. Known issues and checks

1. `src/migrations/` is inside `src`. Prisma migrations should be in `prisma\migrations`. Confirm before moving.
2. `src/app/dashboard/page.backup.tsx`: delete once the new dashboard is confirmed.
3. Finance temporary permissions: `src/modules/finance/finance.service.ts` should use `inventory.manage` (purchases) and `expenses.manage` (expenses). If it still says `inventory.view` or `cash.manage`, change it back.
4. `npm audit` shows 10 vulnerabilities. Run `npm audit fix` (not `--force`).
5. Prisma warns that `package.json#prisma` is deprecated. Move to `prisma.config.ts` later.
6. `.env` still has DEMO passwords. Change them before real use. Never share `.env`.
7. Rate limit is in memory. It resets when the server restarts. Move to the database before production.
8. Owner must verify real menu prices and real recipe quantities. Demo values are still in use.
9. Stock deduction uses `FOR UPDATE` lock (Batch 18). Confirm with the parallel test.
10. Partial unique indexes for item codes live in a raw SQL migration. Prisma `migrate dev` may try to drop them. If it does, do not apply that SQL and check with a helper first.

## 6. Next steps (in order)

1. Run `npx tsc --noEmit` and `npm run build`. Fix errors first.
2. Browser smoke test: login → dashboard → POS (add items, send to kitchen) → kitchen board → public menu → admin pages.
3. Item codes test (Phase 1): assign code, lookup, change code (old code becomes alias), duplicate blocked.
4. Employee Batch 1: profile fields and department model, then grant employee permissions.
5. Delivery: link delivery status to order status. Rider assignment by user, not free text.
6. Payment screen: `SERVED` orders → cash shift payment → receipt.
7. Kitchen board redesign (dark, status columns, timers).
8. Inventory dashboard with low-stock alerts.
9. Workforce batches (attendance → activity → complaints → performance → warnings → salary).
10. Tests: add Vitest and API tests for the security rules (role access, branch access, duplicate codes, price history).
11. Production: `npm audit fix`, change passwords, backup script, HTTPS, deployment.

## 7. Reusable prompt (paste at the top of any new chat)

```
Project: Khan Burger restaurant system. Next.js 16 App Router, React 19, TypeScript strict,
Tailwind v4, Prisma 6.19.3, PostgreSQL 16 (Docker), Windows PowerShell.

Rules:
- Do not rebuild. Extend the existing code. Do not delete existing modules, APIs or data.
- Money is integer paisa. Quantities are integers.
- Never delete orders or payments. Use reversals or status changes.
- History is append-only (stock, audit, status events, price versions, item code history).
- Enforce permissions and branch access on the server, every API.
- Maker-checker for cancellations and refunds.
- Idempotency keys on order and payment creation.

My task: <describe the task in one or two lines>

Give: (1) the exact file path for each file, (2) full file content, (3) PowerShell commands,
(4) expected output. Keep it short. Do not change files I did not mention.
```

## 8. Suggested features (ranked, to make the idea more efficient)

1. Thermal receipt printing (ESC/POS) and reprint with audit.
2. Void and refund with approval (reuse the approvals module).
3. Kitchen SLA timers and delay alerts (feeds the delivery and kitchen activity log).
4. Low-stock alerts on the dashboard, with a threshold per ingredient.
5. Shift-end cash report with variance (uses existing cash shifts).
6. Customer phone history (repeat customers, complaints lookup).
7. Delivery rider assignment and live status for the delivery panel.
8. Owner alerts on WhatsApp or SMS (needs provider credentials).
9. Automatic daily database backup (`pg_dump`) and a restore guide.
10. POS keyboard shortcuts (F-keys) and an on-screen shortcut list.
11. Menu CSV/Excel import with dry-run and import history.
12. Quick staff switch with a PIN at the POS.
13. Admin audit viewer page (filter by user, action, date).

## 9. Time-saving rules

- Give one batch at a time. Test it before the next.
- Use one verification script per batch (same style as the test scripts used so far).
- Keep a `KBR_HANDOFF.md` in the project folder and update the status table after each batch.