# BarStock 🍸

A lightweight, mobile-first bar inventory tracker with visual bottle levels and CocktailDB integration.

## Features

- **Stock Management** - Track bottles with animated fill-level visualization
- **Drink Recipes** - Create and manage cocktail recipes with ingredients
- **"Made It" Button** - Automatically reduces stock when you make a drink
- **CocktailDB Integration** - Browse and import 600+ cocktail recipes
- **Guest Menu** - Share a view-only menu with guests
- **Simple Auth** - Passcode-based access (no accounts needed)
- **Mobile Friendly** - Large buttons, drunk-proof UI

## Screenshots

The app features an animated bottle that drains as you use ingredients:
- Green (>50%) → Yellow (25-50%) → Red (<25%)

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) runtime

### Installation

```bash
git clone https://github.com/dazrave/bar-stock.git
cd bar-stock
bun install
bun run dev
```

Open http://localhost:3000

### Default Passcodes
- **Owner:** `1234` (full access)
- **Guest:** `0000` (menu view only)

Change these in Settings after first login.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Backend | Hono |
| Frontend | React |
| Database | SQLite |
| Styling | Tailwind CSS |

## Usage

### Managing Stock
1. Login with owner passcode
2. Go to **Stock** tab
3. Add bottles with name, category, and volume
4. Use +/- buttons to adjust levels
5. Hit **Refill** when you buy a new bottle

### Adding Drinks
1. Go to **Drinks** tab
2. Click **+ Add**
3. Enter name, category, instructions
4. Add ingredients (optionally link to stock items)
5. Set amounts in ml for auto-deduction

### Browsing CocktailDB
1. Go to **Browse** tab
2. Click **Sync DB** to fetch recipes (one-time)
3. Search or get random suggestions
4. Click **+ Add to Drinks** to import

### Making a Drink
1. Select a drink from **Drinks** or **Menu**
2. Click **Made It!**
3. Stock levels automatically decrease

## Deployment

### Docker
```bash
docker compose up -d
```

### Systemd (Linux)
```bash
# Create service file at /etc/systemd/system/barstock.service
sudo systemctl enable barstock
sudo systemctl start barstock
```

### Proxmox LXC
See deployment notes in CLAUDE.md

## API

All endpoints under `/api/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth | Login with passcode |
| GET | /stock | List all stock |
| POST | /stock | Add stock item |
| PUT | /stock/:id | Update stock |
| DELETE | /stock/:id | Remove stock |
| GET | /drinks | List all drinks |
| POST | /drinks | Add drink |
| POST | /drinks/:id/make | Make drink (reduce stock) |
| GET | /cocktaildb/search | Search cached cocktails |
| POST | /cocktaildb/sync | Sync from CocktailDB |

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

See `CLAUDE.md` for development guidelines.

## License

MIT

## Credits

- Cocktail data from [TheCocktailDB](https://www.thecocktaildb.com/)
- Built with [Bun](https://bun.sh) and [Hono](https://hono.dev)
