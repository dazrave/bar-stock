# Claude Code Development Guide

## Project Overview
BarStock is a personal bar inventory tracker with visual bottle levels and CocktailDB integration.

## Tech Stack
- **Runtime:** Bun (use `bun` commands, not `node` or `npm`)
- **Backend:** Hono (lightweight web framework)
- **Frontend:** React with Bun's native HTML imports
- **Database:** SQLite via `bun:sqlite`
- **Styling:** Tailwind CSS v4

## Key Commands
```bash
bun run dev          # Start dev server with hot reload
bun run start        # Production start
bun install          # Install dependencies
```

## Project Structure
```
src/
├── server/
│   ├── index.ts     # Main server - Hono routes + Bun.serve
│   └── db.ts        # SQLite schema and queries
└── client/
    ├── index.html   # Entry point (Bun HTML import)
    ├── main.tsx     # React app root
    ├── App.tsx      # Navigation wrapper
    ├── styles.css   # Tailwind + custom CSS
    ├── components/  # Reusable components
    │   └── Bottle.tsx  # Animated SVG bottle
    ├── pages/       # Route pages
    │   ├── Login.tsx
    │   ├── Stock.tsx
    │   ├── Drinks.tsx
    │   ├── Browse.tsx
    │   ├── Menu.tsx
    │   └── Settings.tsx
    └── context/     # React contexts
        ├── AuthContext.tsx
        └── ToastContext.tsx
```

## Database
SQLite file stored at `./data/bar.db`. Schema is auto-created on first run.

Tables:
- `passcodes` - Owner/guest authentication codes
- `stock` - Bottles and ingredients with volume tracking
- `drinks` - User's cocktail recipes
- `drink_ingredients` - Links drinks to stock items
- `cocktaildb_drinks` - Cached recipes from TheCocktailDB

## API Routes
All routes prefixed with `/api/`:
- `POST /auth` - Login with passcode
- `GET/POST/PUT/DELETE /stock` - Stock management
- `GET/POST/PUT/DELETE /drinks` - Drink recipes
- `POST /drinks/:id/make` - Reduce stock when making a drink
- `GET/PUT /settings` - Passcode management
- `GET /cocktaildb/search` - Search cached cocktails
- `POST /cocktaildb/sync` - Fetch from TheCocktailDB API

## Authentication
Simple passcode system with cookie-based sessions:
- Owner: Full access to all features
- Guest: View-only access to menu

Default passcodes (change in Settings):
- Owner: `1234`
- Guest: `0000`

## Development Tips
1. The frontend uses Bun's native HTML imports - no separate build step needed
2. Hot reload works automatically with `bun --hot`
3. SQLite queries are prepared statements in `db.ts`
4. Add new pages in `src/client/pages/` and register in `main.tsx`
5. The Bottle component accepts `currentMl`, `totalMl`, and `size` props

## Adding New Features
1. **New API route:** Add to `src/server/index.ts`
2. **New page:** Create in `pages/`, add route in `main.tsx`
3. **New component:** Add to `components/`
4. **Database change:** Update schema in `db.ts`

## Deployment
Runs on Proxmox LXC container with systemd service.
Service file: `/etc/systemd/system/barstock.service`

```bash
systemctl restart barstock  # Restart after updates
journalctl -u barstock -f   # View logs
```
