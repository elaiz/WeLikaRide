# 🚗 WeLikaRide

A **free, mobile-friendly Progressive Web App (PWA)** for organizing volunteer church rides. Riders request a pickup, volunteer drivers receive alerts, accept a ride, and log their mileage — all for free.

---

## Tech Stack (all free)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | [React](https://react.dev) + [Vite](https://vite.dev) | Fast, modern, free |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Clean minimal UI |
| **PWA** | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | Install on phone like a native app, works offline |
| **Backend / DB** | [Supabase](https://supabase.com) (free tier) | Auth, Postgres DB, realtime updates |
| **Hosting** | [Vercel](https://vercel.com) or [Netlify](https://netlify.com) (free) | Deploy in minutes |
| **Navigation** | Google Maps / Apple Maps deep links | No API key needed, no data stored |

**Why not Blazor?** Blazor WASM requires a larger download (~10 MB) and a .NET ecosystem. React + Vite produces a ~300 KB bundle and the PWA installs instantly on any phone. Both are free; React is the simpler choice for a volunteer team.

---

## Features

- 🙋 **Riders** request a ride with GPS location (or typed address) + optional pickup time + notes
- 🚗 **Drivers** see all pending requests in real-time, accept one, and get a Maps link for directions
- 🛣️ Drivers log mileage when completing a ride; cumulative totals are tracked
- 📜 Ride history for both riders and drivers
- 🔒 Destination is **never stored** — only pickup location (per the privacy goal)
- 📱 Works on any phone as a PWA (add to home screen)

---

## Quick Start

### 1. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Copy your **Project URL** and **anon public key** from *Settings → API*

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Deploy (free)

**Vercel:**
```bash
npm i -g vercel
vercel
```
Set the two `VITE_SUPABASE_*` environment variables in Vercel's project settings.

---

## Project Structure

```
src/
  pages/
    AuthPage.jsx        — Login / Register (choose rider or driver role)
    RiderDashboard.jsx  — Rider home: active ride status
    RequestRide.jsx     — New ride request (GPS or address + time)
    DriverDashboard.jsx — Driver home: pending requests + accept + complete
    RideHistory.jsx     — History + mileage summary for drivers
  components/
    NavBar.jsx          — Top navigation bar
  supabaseClient.js     — Supabase client init
supabase/
  schema.sql            — Database schema (run once in Supabase SQL Editor)
```

---

## Privacy

- Pickup location is stored only while a ride is active
- **Destination is never stored** anywhere
- Navigation directions open directly in Google Maps / Apple Maps (ephemeral, not stored)
- Users authenticate via Supabase Auth (email + password)

---

## Volunteer / No-cost Summary

Every component of this stack has a permanently free tier:
- Supabase free: 500 MB DB, 50,000 monthly active users, realtime included
- Vercel/Netlify free: unlimited hobby deployments
- No paid APIs required
