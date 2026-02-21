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

## Local auth bypass (developer only)

Nightly builds redirect unauthenticated visitors immediately, which makes quick visual checks difficult without staging credentials. For local development you can opt into a mock session by adding the following to `.env.local`:

```
NEXT_PUBLIC_DEV_AUTH_BYPASS=1
NEXT_PUBLIC_DEV_AUTH_BYPASS_EMAIL=dev@tonight.test        # optional override
NEXT_PUBLIC_DEV_AUTH_BYPASS_NAME=Tonight Dev              # optional override
```

You can also set `NEXT_PUBLIC_DEV_AUTH_BYPASS_ID`, `NEXT_PUBLIC_DEV_AUTH_BYPASS_PHOTO`, or `NEXT_PUBLIC_DEV_AUTH_BYPASS_CREATED_AT` if you need more control over the mock profile.

The bypass only works when `NODE_ENV !== "production"` and never ships with production builds. When enabled, the UI behaves as if a lightweight user is signed in so you can inspect authenticated screens without waiting for an invite link.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
