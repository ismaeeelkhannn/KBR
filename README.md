# KBR

THIS IS FOR KBR

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Local PostgreSQL database

The Docker Compose setup runs PostgreSQL only; run the Next.js app separately with Node.

1. Copy `.env.example` to `.env` and set a local database password.
2. Start PostgreSQL with `docker compose up -d`.
3. Check startup with `docker compose ps`; PostgreSQL is ready when its health status is `healthy`.
4. Stop the container with `docker compose down`. The `kbr_pgdata` volume keeps the database data.

The database is available on `localhost` at the port configured by `POSTGRES_PORT` (default `5432`).

The Prisma schema is in `prisma/schema.prisma` and reads its connection string from `DATABASE_URL`. After PostgreSQL is running, apply the schema with `npm run db:migrate`, generate the Prisma Client with `npm run db:generate`, and check the connection with `npm run db:check`. Run `npm run db:seed` to upsert the demo roles, permissions, branch, and cash registers. Set `DEMO_OWNER_USERNAME` and a 12+ character `DEMO_OWNER_PASSWORD` in `.env`, then run `npm run db:create-owner` to create the demo owner.

Sign in at `/login` with the demo owner credentials to open the protected `/dashboard`. Use the dashboard's **Logout** button to revoke the current session and return to `/login`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
