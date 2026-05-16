# Løbecoach AI

AI-drevet løbetræner webapp – Next.js, Prisma, Claude/Gemini.

---

## Kom i gang lokalt (5 minutter)

### Krav
- [Node.js 18+](https://nodejs.org)
- Ingen database-konto nødvendig (bruger SQLite lokalt)

### Trin

```bash
# 1. Gå ind i mappen
cd running-coach

# 2. Installer pakker
npm install

# 3. Opret .env fil
cp .env.example .env
# Rediger NEXTAUTH_SECRET til en tilfældig streng (min. 32 tegn)

# 4. Opret databasetabeller
npm run db:push

# 5. Start appen
npm run dev
```

Åbn **http://localhost:3000** og opret en konto.

---

## Deploy til Vercel + Neon (gratis)

### 1. Opret gratis PostgreSQL på Neon
1. Gå til [neon.tech](https://neon.tech) og opret gratis konto
2. Klik "New Project" → vælg region (EU Central anbefales)
3. Kopiér **Connection string** (starter med `postgresql://...`)

### 2. Skift database i koden
I `prisma/schema.prisma`, skift:
```prisma
provider = "sqlite"   →   provider = "postgresql"
```

### 3. Push til Vercel
1. Push koden til GitHub
2. Gå til [vercel.com](https://vercel.com) og importer projektet
3. Tilføj miljøvariabler i Vercel dashboard:
   - `DATABASE_URL` = din Neon connection string
   - `NEXTAUTH_URL` = din Vercel URL (f.eks. `https://minapp.vercel.app`)
   - `NEXTAUTH_SECRET` = tilfældig streng
   - `ANTHROPIC_API_KEY` eller `GOOGLE_AI_KEY` (valgfri)
4. Deploy

---

## Miljøvariabler

| Variabel | Beskrivelse | Påkrævet |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) eller Neon/Supabase URL | Ja |
| `NEXTAUTH_URL` | URL til appen | Ja |
| `NEXTAUTH_SECRET` | Tilfældig hemmelig streng | Ja |
| `ANTHROPIC_API_KEY` | Claude API nøgle | Nej |
| `GOOGLE_AI_KEY` | Google Gemini nøgle (gratis tier) | Nej |
| `AI_PROVIDER` | `auto`, `claude` eller `gemini` | Nej |

---

## Funktioner

| Feature | Beskrivelse |
|---|---|
| **Import fra Intervals.icu** | Sync alle dine løb direkte via API |
| **Fil-upload** | GPX, TCX, FIT (fra Apple Health/Garmin/Strava) |
| **Dashboard** | CTL/ATL/TSB belastningskurve, ugentlig km, seneste løb |
| **AI-coach** | Chat, statusanalyse, anbefalinger (kræver API-nøgle) |
| **Træningsplan** | AI-genereret program med push til Intervals.icu |
| **Trænernoter** | Humør, søvn, stress, livshændelser |
