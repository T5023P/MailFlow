# MailFlow — Cold Email Campaign Platform

A full-stack cold email automation platform built with React, Express, Supabase, and Nodemailer.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express) ![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase) ![Nodemailer](https://img.shields.io/badge/Nodemailer-Gmail_SMTP-EA4335?logo=gmail)

---

## Features

- **Multi-Account Rotation** — Add multiple Gmail senders, auto-rotate with daily caps
- **CSV Lead Import** — Bulk import leads via CSV with duplicate detection
- **Template Editor** — Create email templates with `{{variable}}` placeholders and live preview
- **Campaign Manager** — Launch, pause, stop campaigns with real-time progress tracking
- **Background Sending** — Randomized delays between emails to mimic human behavior
- **Dashboard** — Live stats with auto-polling every 5 seconds

---

## Quick Start

### 1. Clone & Install

```bash
cd mailflow
cd server && npm install
cd ../client && npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://app.supabase.com)
2. Go to **SQL Editor** and paste the contents of `server/schema.sql`
3. Run the SQL to create all tables
4. Go to **Settings → API** and copy your **Project URL** and **anon public key**

### 3. Get a Gmail App Password

> **You need a Gmail App Password, NOT your regular password.**

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Navigate to **Security → 2-Step Verification** (enable if not already)
3. Scroll down and click **App passwords**
4. Select **Mail** and your device, then click **Generate**
5. Copy the 16-character password (e.g. `abcd efgh ijkl mnop`)
6. Use this App Password when adding an account in MailFlow

### 4. Configure Environment Variables

**server/.env:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
PORT=3001
```

**client/.env:**
```env
VITE_API_URL=http://localhost:3001
```

### 5. Run Locally

Terminal 1 — Backend:
```bash
cd server
npm run dev
```

Terminal 2 — Frontend:
```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy

### Backend → Railway

1. Push `server/` to a GitHub repo
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `PORT` = `3001`
4. Railway will auto-detect Node.js and run `npm start`
5. Copy your Railway URL (e.g. `https://mailflow-server.up.railway.app`)

### Frontend → Vercel

1. Push `client/` to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **New Project → Import**
3. Set environment variable:
   - `VITE_API_URL` = your Railway backend URL
4. Framework preset: **Vite**
5. Deploy

---

## Project Structure

```
mailflow/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── api/index.js     # All API calls
│   │   ├── pages/           # Dashboard, Accounts, Leads, Templates, Campaigns
│   │   ├── App.jsx          # Router
│   │   ├── main.jsx         # Entry point
│   │   └── index.css        # Design system
│   └── ...config files
├── server/                  # Express backend
│   ├── routes/              # accounts, leads, templates, campaigns
│   ├── services/            # mailer.js, queue.js
│   ├── db.js                # Supabase client
│   ├── schema.sql           # Database DDL
│   └── index.js             # Entry point
└── README.md
```

---

## License

MIT
