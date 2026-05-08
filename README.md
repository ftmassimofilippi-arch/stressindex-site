# Stress Index — Sito Ufficiale

Sito web ufficiale di Stress Index, il primo software italiano di analisi HRV professionale.

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Linguaggio:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (EU Frankfurt)
- **Deploy:** Vercel
- **Dominio:** stressindex.io

## Setup locale

```bash
# 1. Installa dipendenze
npm install

# 2. Copia e configura le variabili d'ambiente
cp .env.example .env.local
# Modifica .env.local con le tue credenziali Supabase

# 3. Esegui la migrazione SQL su Supabase
# Copia il contenuto di supabase-migration.sql nel SQL Editor di Supabase

# 4. Avvia il server di sviluppo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Deploy su Vercel

1. Crea un repository GitHub e fai push del codice
2. Vai su [vercel.com](https://vercel.com) e importa il repository
3. Configura le variabili d'ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
4. Deploy automatico ad ogni push su main

## Struttura

```
src/
├── app/
│   ├── layout.tsx              # Layout root + metadata SEO
│   ├── page.tsx                # Homepage (temporanea)
│   └── registrazione/
│       ├── page.tsx            # Pagina registrazione trial
│       ├── RegistrationForm.tsx # Form client component
│       └── conferma/
│           └── page.tsx        # Pagina conferma post-registrazione
├── components/
│   ├── Header.tsx
│   └── Footer.tsx
├── lib/
│   ├── supabase-browser.ts    # Client Supabase per componenti client
│   ├── supabase-server.ts     # Client Supabase per componenti server
│   └── validation.ts          # Validazione form
└── styles/
    └── globals.css            # Tailwind + design tokens
```

## Palette

| Colore | Hex | Uso |
|--------|-----|-----|
| Teal | #4FA39A | Primario, CTA, accenti |
| Teal Dark | #2E746C | Hover, testi evidenziati |
| Anthracite | #2F343A | Testi principali |
| Background | #F6F7F8 | Sfondo pagine |
| White | #FFFFFF | Card, superfici |
