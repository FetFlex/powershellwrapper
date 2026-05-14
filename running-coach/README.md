# Løbecoach AI

AI-drevet løbetræner webapp bygget med Next.js, Prisma og Claude/Gemini.

## Funktioner
- Import løb fra Intervals.icu (direkte via API) eller via GPX/TCX/FIT filer
- Dashboard med CTL/ATL/TSB belastningskurve og ugentlig kilometre
- AI-coach chat og statusanalyse (understøtter Claude og Gemini)
- Træningsplangenerator med push til Intervals.icu
- Trænernoter med humør, energi, søvn og livshændelser

## Kom i gang

### 1. Installer afhængigheder
```bash
cd running-coach
npm install
```

### 2. Opret database
Kræver en PostgreSQL-database. Kopier `.env.example` til `.env` og udfyld:
```bash
cp .env.example .env
# Rediger .env med dine værdier
```

### 3. Kør database migrations
```bash
npm run db:push
```

### 4. Start udviklingsserver
```bash
npm run dev
```

Åbn http://localhost:3000

## Miljøvariabler

| Variabel | Beskrivelse |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | URL til appen (http://localhost:3000 lokalt) |
| `NEXTAUTH_SECRET` | Tilfældig streng (generer med `openssl rand -base64 32`) |
| `ANTHROPIC_API_KEY` | Claude API nøgle (valgfri) |
| `GOOGLE_AI_KEY` | Google Gemini API nøgle (valgfri, gratis tier) |
| `AI_PROVIDER` | `auto`, `claude` eller `gemini` (standard: `auto`) |

**Bemærk:** Appen fungerer uden AI-nøgler — kun coach-chatten og analysefunktionen kræver en nøgle.

## Deploy til Vercel

1. Push til GitHub
2. Import projekt i Vercel
3. Tilføj miljøvariabler i Vercel dashboard
4. Brug Railway eller Supabase til PostgreSQL-database

## AI-udbydere

Appen skifter automatisk baseret på hvilken nøgle der er tilgængelig:
- Har du `ANTHROPIC_API_KEY` → bruger Claude Opus
- Har du `GOOGLE_AI_KEY` → bruger Gemini 1.5 Flash (gratis tier: 1M tokens/dag)
- Ingen nøgle → AI-funktioner viser vejledning om at tilføje nøgle
