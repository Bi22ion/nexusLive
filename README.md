# Strat-Clone Engine

Multi-tenant SaaS platform for uploading historical trading data, training behavioral ML models, and executing automated trades via broker APIs.

## Architecture

```
nexuslive/
├── web/                  # Next.js 15 frontend (port 3000)
├── server/               # Express API backend (port 3001)
├── worker/               # Background execution worker
├── scripts/              # Python ML training script
├── supabase/migrations/  # PostgreSQL schema
└── sample-data/          # Sample CSV for testing
```

## Prerequisites

- Node.js 18+
- PostgreSQL (Supabase recommended)
- Python 3.9+ (optional, for Python ML pipeline)

## Setup

### 1. Database

Create a Supabase project and run the migration:

```bash
# In Supabase SQL Editor, run:
supabase/migrations/001_initial_schema.sql
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Random secret for JWT tokens |
| `ENCRYPTION_KEY` | 64-char hex string (32 bytes) for AES-256-GCM |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` |

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Install Dependencies

```bash
npm run install:all
```

### 4. Python ML (Optional)

```bash
pip install -r scripts/requirements.txt
```

The Node.js trainer works out of the box; Python is an alternative pipeline.

### 5. Run Development

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Worker**: Background bot execution loop

## Pages

| Route | Description |
|-------|-------------|
| `/` | Public landing page with features & pricing |
| `/login` | User authentication |
| `/signup` | User registration |
| `/dashboard` | Overview with metric cards |
| `/dashboard/datasets` | CSV upload & column mapping |
| `/dashboard/models` | ML model training & analytics |
| `/dashboard/broker` | Encrypted broker API configuration |
| `/dashboard/bots` | Bot control panel & kill switch |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/dashboard/summary` | Dashboard metrics |
| POST | `/api/datasets/upload` | Upload CSV |
| POST | `/api/datasets/:id/parse` | Parse with column mapping |
| POST | `/api/models/train` | Train behavioral model |
| POST | `/api/broker` | Save encrypted API keys |
| POST | `/api/broker/test` | Test broker connection |
| POST | `/api/bots` | Create trading bot |
| POST | `/api/bots/kill-switch` | Emergency halt all bots |

## Workflow

1. **Sign up** and log in
2. **Upload** a CSV of trade history (`sample-data/sample-trades.csv`)
3. **Map columns** (timestamp, symbol, entry/exit prices, P&L)
4. **Train a model** to extract behavioral patterns
5. **Configure broker** API keys (Alpaca paper trading recommended)
6. **Create and start a bot** to execute trades
7. Monitor via **execution logs**; use **kill switch** if needed

## Security

- Passwords hashed with bcrypt (12 rounds)
- Broker API keys encrypted with AES-256-GCM at rest
- JWT-based session authentication
- Multi-tenant data isolation via `user_id` foreign keys

## Design System

- Dark mode fintech UI (Slate/Zinc palette)
- JetBrains Mono for financial data display
- Pulsing status indicators for bot states
- Toast notifications for user feedback

## License

MIT
