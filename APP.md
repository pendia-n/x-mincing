# Our Trailer, Our Rules

## What the pilot does

This is a private two-person film prompt game. A creator makes a one-use invite link, a second account joins, and each person gets a different set of three prompts. Each person uploads three short clips. Once all six clips exist, either person can open the shared reveal. The reveal plays the real clips in sequence in the browser; it does not render or download a finished edited video file.

The pilot has signup, sign-in, recovery, profile, security, pricing, about, and announcements pages. It has no payments, social feed, public profiles, email provider, AI video generation, or public sharing by default. The $5.99 per duo figure is a research hypothesis only; the pilot is free.

## Cloudflare resources

- Worker: `xmincing`
- D1: `xmincing-db`, bound as `DB`
- R2: `xmincing-media`, bound as `MEDIA`; it has no public bucket domain
- Daily cleanup: removes expired rooms and their R2 clips after 30 days, plus expired session, invite, and share-link records

Run the D1 migration before the first deploy:

```sh
pnpm exec wrangler d1 migrations apply xmincing-db --remote
```

The app signing secret is in `/Users/nosensetxt/mvp/mine-yours/xmincing/.env` as `JWT_SECRET`. Keep that file local and mode `0600`. For a deployment, put the same value in the Worker secret store without displaying it in a terminal transcript:

```sh
awk -F= '$1 == "JWT_SECRET" { sub(/^[^=]*=/, ""); print; exit }' .env | pnpm exec wrangler secret put JWT_SECRET
```

Then build and deploy:

```sh
pnpm build
pnpm exec wrangler deploy
```

## Identity and session behavior

Passwords and one-time recovery codes use Cloudflare Workers Web Crypto PBKDF2-SHA-256 with a fresh random salt and 600,000 iterations. Session tokens are HS256 JWTs signed with `JWT_SECRET`; active token IDs are also held in D1 so sign-out and password recovery revoke them. The session cookie is HttpOnly, SameSite=Lax, Secure on HTTPS, and lasts 65 days. Passwords use 7–18 characters with at least one letter and number. Usernames are unique, case-insensitive, and contain 3–20 letters, digits, or underscores.

There is no email-based recovery. The user receives an eight-character recovery code once after signup and again after recovery; only its salted hash is stored. Login and recovery attempts are rate-limited by username and Cloudflare client IP.

## Privacy and consent

- R2 objects are private and only streamed through authenticated room routes or a live, jointly approved share link.
- The uploader confirms they made the clip or have permission to use it. Uploads are limited to 20 seconds and 30 MB per clip.
- Invite links are single-use and expire after seven days.
- Rooms and clips expire after 30 days. Shared links expire after 14 days; either participant can revoke approval, which invalidates existing links.
- A room creator can permanently delete the room and all its clips at any time.
- A share link exposes the six clips and usernames to anyone who receives it while it is active. Both participants must approve before one is created.

## Local and release checks

Use the Cloudflare preview runtime for D1/R2 bindings rather than the plain Vite server:

```sh
pnpm build
pnpm exec wrangler dev
```

Before release, verify signup, sign-in, recovery, a two-account invite and join, all six uploads, the reveal, one-person and two-person share approval, share revocation, and the daily expiry cleanup. Do not use real sensitive footage for smoke checks.
