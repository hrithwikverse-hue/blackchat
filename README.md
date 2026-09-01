# BlackChat — Instagram Comment → DM Automation

A private, single-user Instagram automation system. When someone comments a configured keyword on one of your Instagram posts or reels, it automatically sends them a private DM reply using Meta's official Instagram Graph API and Webhooks.

> ⚠️ **Uses Meta's official APIs only.** No scraping, no unofficial APIs, no browser automation.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Meta Developer App Setup](#meta-developer-app-setup)
3. [Supabase Setup](#supabase-setup)
4. [Environment Variables](#environment-variables)
5. [Local Development](#local-development)
6. [Cloudflare Tunnel (Webhook)](#cloudflare-tunnel-webhook)
7. [Webhook Configuration in Meta Dashboard](#webhook-configuration-in-meta-dashboard)
8. [Connect Instagram](#connect-instagram)
9. [Create an Automation](#create-an-automation)
10. [Testing](#testing)
11. [Known Meta Restrictions](#known-meta-restrictions)
12. [Cloudflare Deployment](#cloudflare-deployment)

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Instagram Creator or Business account** connected to a Facebook Page
  - Personal accounts are not supported by any official Meta API
- **Meta Developer account** — [developers.facebook.com](https://developers.facebook.com)
- **Supabase account** — [supabase.com](https://supabase.com)
- **Cloudflare account** (free) — for Cloudflare Tunnel during local development

---

## Meta Developer App Setup

### 1. Create a Meta Developer App

1. Go to [https://developers.facebook.com/apps/](https://developers.facebook.com/apps/)
2. Click **Create App**
3. Select **Business** as the app type
4. Fill in app name (e.g. "BlackChat Automation") and your business email
5. Click **Create App**

### 2. Add the Instagram product

1. In your app dashboard, click **Add Product**
2. Find **Instagram** and click **Set Up**
3. Under **Settings > Basic**, note your **App ID** and **App Secret**

### 3. Configure OAuth redirect URI

1. Go to **Instagram > API Setup with Business Login**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://your-tunnel.trycloudflare.com/api/instagram/callback
   ```
   (You'll fill this in after setting up the Cloudflare Tunnel)

### 4. Add Test Users (for development)

1. Go to **Roles > Test Users** in the app dashboard
2. Click **Add Test Users** and add your Instagram account email
3. You can now test without App Review approval

### 5. Add Required Permissions

Under **Instagram > Permissions and Features**, request:
- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`
- `pages_show_list`
- `pages_read_engagement`

> **App Review Note:** For development/testing with your own account as a Test User, you don't need App Review. Full App Review is required to use these permissions with other users' accounts.

---

## Supabase Setup

### 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create an account
2. Click **New Project**
3. Choose a name, password, and region

### 2. Run database migrations

In the Supabase Dashboard, go to **SQL Editor** and run the contents of these files **in order**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

### 3. Create your admin user

In the Supabase Dashboard, go to **Authentication > Users** and click **Invite User**. Enter your email address. You'll receive an email to set a password.

### 4. Get your API keys

Go to **Settings > API** and note:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then fill in all values:

```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_random_verify_token
META_REDIRECT_URI=https://your-tunnel.trycloudflare.com/api/instagram/callback
META_GRAPH_API_VERSION=v22.0

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciO...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciO...

ENCRYPTION_SECRET=<output of: openssl rand -hex 32>

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Generate `ENCRYPTION_SECRET`:**
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows PowerShell:
-join (1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

**Generate `META_VERIFY_TOKEN`** (any random string):
```bash
openssl rand -hex 16
```

---

## Local Development

### 1. Install dependencies

```bash
cd blackchat
npm install
```

### 2. Start the Next.js dev server

```bash
npm run dev
```

The app runs at: [http://localhost:3000](http://localhost:3000)

### 3. Sign in

Navigate to `http://localhost:3000/login` and sign in with the email/password you created in Supabase.

---

## Cloudflare Tunnel (Webhook)

Meta requires a publicly accessible **HTTPS** URL to deliver webhooks. During local development, use Cloudflare Tunnel.

### Install cloudflared

Download from [https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

Or with npm:
```bash
npm install -g cloudflared
```

### Start the tunnel

In a **separate terminal** while your dev server is running:

```bash
cloudflared tunnel --url http://localhost:3000
```

You'll see output like:
```
Your quick Tunnel has been created! Visit it at:
https://abc123.trycloudflare.com
```

**Your webhook URL will be:**
```
https://abc123.trycloudflare.com/api/webhooks/instagram
```

> ⚠️ The free Cloudflare Tunnel URL changes every time you restart the tunnel. For a permanent URL, use a [Named Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/).

---

## Webhook Configuration in Meta Dashboard

1. Go to your Meta App Dashboard
2. Navigate to **Instagram > Webhooks** (or **Products > Webhooks**)
3. Click **Add Callback URL**
4. Enter:
   - **Callback URL:** `https://your-tunnel.trycloudflare.com/api/webhooks/instagram`
   - **Verify Token:** (same value as `META_VERIFY_TOKEN` in your `.env.local`)
5. Click **Verify and Save**
6. Meta will call your GET endpoint to verify the token
7. Under **Webhook Fields**, subscribe to:
   - `comments`
   - `live_comments`
   - `messages`

---

## Connect Instagram

1. Go to `http://localhost:3000/settings`
2. Click **Connect Instagram**
3. You'll be redirected to Meta's OAuth authorization page
4. Select your Facebook Page (which must have your Instagram Creator account connected)
5. Grant the requested permissions
6. You'll be redirected back to the dashboard

> 💡 If you're a Test User in your Meta app, you can complete this flow without App Review.

---

## Create an Automation

1. Click **Create Automation** on the dashboard
2. **Step 1 — Select Content:** Choose a post/reel or "Any post"
3. **Step 2 — Set Trigger:** Enter the keyword (e.g. `GUIDE`) and match type
4. **Step 3 — Write DM:** Compose the message and optional link
5. **Step 4 — Review:** Confirm and activate

**Example:**
- Keyword: `GUIDE`
- Match type: Contains
- DM: "Hey! Thanks for commenting 👋 Here's the guide you asked for:"
- Link: `https://your-site.com/guide`

When someone comments `"Can I have the GUIDE?"`, they receive:
```
Hey! Thanks for commenting 👋 Here's the guide you asked for:

Get the Guide: https://your-site.com/guide
```

---

## Testing

### Unit tests (no Meta API required)

```bash
npm test
```

Tests cover:
- Keyword normalization (lowercase, trim, punctuation)
- Exact / contains / starts_with matching
- Case-insensitive matching
- Media ID filtering
- Inactive automation skipping
- URL validation (HTTPS only)
- Message text building

### Test webhook verification

In Meta Dashboard → Webhooks, click **Test** next to the webhook subscription. This triggers a GET verification call.

### Test keyword matching (in-app)

Go to **Settings → Test: Keyword Matching** and enter a simulated comment to see if it matches any active automation. No real DM is sent.

### Test sending a real DM

Go to **Settings → Test: Send Private Reply**. Enter a real comment ID from one of your posts. The message will be prefixed with `[TEST]`. This **does** send a real DM.

### Full end-to-end test

1. Ensure the dev server and tunnel are running
2. Connect Instagram via OAuth
3. Create an automation with keyword `TEST123` on "Any post"
4. Comment `TEST123` on one of your posts
5. Within seconds, you should receive a DM

---

## Known Meta Restrictions

| Restriction | Detail |
|---|---|
| **Professional account required** | Must be a Business or Creator account. Personal accounts unsupported. |
| **One private reply per comment** | You can only send one private reply per comment. |
| **7-day window** | Private replies must be sent within 7 days of the comment. |
| **Live broadcasts** | Replies to live comments only work while the broadcast is active. |
| **App Review for Live mode** | `instagram_business_manage_messages` requires App Review for non-test accounts. |
| **Rate limits** | Meta enforces per-user and per-app rate limits. |
| **API versioning** | Update `META_GRAPH_API_VERSION` as needed. v20.0 deprecated Sep 2026. |

### App Review Process

To use the app with accounts other than your own test account, you must submit for App Review:

1. In Meta App Dashboard → **App Review → Requests**
2. Request advanced access for `instagram_business_manage_messages`
3. Provide a screencast showing the feature in action
4. Explain the use case clearly
5. Ensure your app is in **Live mode** (not development mode)

---

## Cloudflare Deployment

The app is structured for easy Cloudflare Pages / Workers deployment:

1. Push the code to a GitHub repo
2. Connect to Cloudflare Pages
3. Set environment variables in the Cloudflare Pages dashboard
4. Update `META_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to your Cloudflare domain
5. Update the webhook callback URL in Meta Dashboard

> **Note:** The webhook uses `setImmediate` for async processing. Verify Cloudflare compatibility and consider using background tasks or queue workers for production.

---

## Project Structure

```
blackchat/
├── app/
│   ├── api/
│   │   ├── automations/          # CRUD API for automations
│   │   ├── instagram/            # OAuth connect, callback, posts, send-message, disconnect
│   │   ├── stats/                # Dashboard statistics
│   │   └── webhooks/instagram/   # Meta webhook endpoint (GET verify + POST process)
│   ├── (dashboard)/              # Route group with sidebar layout
│   ├── automations/              # List, new wizard, detail/edit pages
│   ├── activity/                 # Execution log
│   ├── dashboard/                # Main dashboard
│   ├── login/                    # Auth page
│   └── settings/                 # Connection, webhook, test tools
├── lib/
│   ├── automation/               # matcher.ts, executor.ts
│   ├── meta/                     # instagram.ts, messages.ts, webhooks.ts
│   ├── security/                 # encryption.ts (AES-256-GCM)
│   ├── supabase/                 # client.ts, server.ts
│   └── validation/               # schemas.ts (Zod)
├── components/
│   └── Sidebar.tsx
├── supabase/migrations/          # SQL migration files
├── __tests__/                    # Vitest unit tests
├── .env.example
└── README.md
```

---

## Security

- Access tokens are **AES-256-GCM encrypted** before database storage
- Tokens are **never sent to the browser** — all Meta API calls are server-side
- Webhook authenticity verified with **HMAC-SHA256** signature check
- Single-user auth via **Supabase Auth** with **Row Level Security** on all tables
- **CSRF protection** on OAuth flow via state cookie
- All API routes require authentication
