# NexusLive

Next-generation live streaming platform built with Next.js 15, Supabase Realtime, and WebRTC.

## Architecture

```
nexuslive/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React UI components
│   └── lib/              # Supabase client, realtime utils, helpers
├── public/               # Static assets
└── supabase/
    ├── migrations/       # Database schema & RLS policies
    └── functions/        # Edge functions
```

## Prerequisites

- Node.js 18+
- Supabase project (database, auth, realtime, edge functions)

## Setup

### 1. Environment

Supabase credentials are pre-populated in `.env`:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development

```bash
npm run dev
```

Frontend: http://localhost:3000

## Features

| Route | Description |
|-------|-------------|
| `/` | Live stream grid with realtime updates |
| `/model/[username]` | Model profile & live viewer room |
| `/pk/[battleId]` | Live PK battle arena |
| `/studio` | Creator broadcast studio |
| `/gallery` | Browse all creators |
| `/recordings` | VOD replay library |
| `/wallet` | Token & diamond wallet |
| `/favorites` | Followed creators |
| `/history` | Watch history |

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS 4
- Supabase (Postgres, Realtime, Auth, Edge Functions)
- WebRTC for live streaming
- Framer Motion for animations

## License

MIT
