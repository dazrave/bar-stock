# BarStock Roadmap

## Current State (v1.0)

### Implemented Features
- **Stock Management**: Track bottles with ml levels, visual bottle fill indicators
- **Drinks/Recipes**: Create and manage personal drink recipes with ingredients
- **Browse Cocktails**: Search CocktailDB (~600 drinks) and IBA Official (~90 drinks)
- **Shopping List**: Track items to buy, low stock suggestions (<25%), "bought" flow
- **Volume Handling**: Support oz/cl/ml input, always display in ml
- **Availability Filtering**: Show/hide drinks based on ingredient availability
- **Glass Icons**: Display glass type with emoji icons
- **Authentication**: Owner/guest passcode system

---

## Planned Features

### Phase 1: Usage Tracking (SIMPLE)

#### Drink Counter
- [ ] Add `times_made` column to drinks table
- [ ] Increment counter when "Made it" is clicked
- [ ] Display "Made X times" badge on drink cards
- [ ] Track total ml used per stock item (cumulative)

#### Stock Usage Stats
- [ ] Add `total_used_ml` column to stock table
- [ ] Deduct from stock AND add to total_used when making drink
- [ ] Show "Used: 2.5L all time" on stock items

**Decided**: Counter only, no detailed history. Simple and clean.

---

### Phase 2: Misc Ingredients & Garnishes (SIMPLE)

#### Non-liquid Stock Items
- [ ] Add `unit_type` field to stock: "ml" (default) or "count"
- [ ] For count items: track as whole numbers (5 lemons, 12 eggs)
- [ ] Display as "5 remaining" instead of "500ml"
- [ ] Deduct by count when making drinks

#### In Recipes
- [ ] Allow ingredient amounts like "1 lemon" or "2 dashes"
- [ ] Garnishes stored as text field (not linked to stock)
- [ ] Garnishes do NOT affect "can make" status

**Decided**: Simple count tracking. Garnishes are informational only, never block drinks.

---

### Phase 3: Custom Menus

#### Menu Management
- [ ] Create named menus (e.g., "House Favorites", "Non-Alcoholic", "Summer Drinks")
- [ ] Add drinks from "My Drinks" to menus (must import first)
- [ ] Reorder drinks within menus (drag & drop)
- [ ] Menu descriptions/headers

#### Menu Display
- [ ] Owner: manage which menus are active
- [ ] Guest: sees list of active menus to browse
- [ ] Ghost/hide unavailable drinks (missing ingredients)

#### Database
```sql
CREATE TABLE menus (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE menu_drinks (
  menu_id INTEGER,
  drink_id INTEGER,  -- references drinks table (My Drinks)
  sort_order INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0
);
```

**Decided**: Menus contain drinks from "My Drinks" only. Import from IBA/CocktailDB first.

---

### Phase 4: Guest Experience & Drink Requests

#### Guest View
- [ ] See active menus with available drinks
- [ ] Browse "all available" drinks (can make = true)
- [ ] Clean, simple UI focused on ordering

#### Request System
- [ ] "Request" button on each drink
- [ ] Prompt: "Enter your name" (simple text input)
- [ ] Request goes to queue with name + drink + timestamp
- [ ] Guest sees "Requested!" confirmation

#### Owner Queue View
- [ ] New nav item or notification badge for pending requests
- [ ] Queue shows: Guest Name | Drink | Time requested
- [ ] Actions: "Making" (in progress) | "Done" (removes from queue, increments counter, deducts stock)
- [ ] Optional: "Decline" with reason

#### Database
```sql
CREATE TABLE drink_requests (
  id INTEGER PRIMARY KEY,
  drink_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, making, done, declined
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

#### Future: Real-time (optional)
- [ ] WebSocket for live queue updates
- [ ] Guest sees "Your drink is being made!" status
- [ ] Sound/vibration notification

**Decided**: Simple name prompt, no guest accounts. Queue managed by owner.

---

### Phase 5: Cost & Inventory Analysis

#### Cost Tracking
- [ ] Cost per bottle field in stock
- [ ] Calculate cost per drink
- [ ] Track spending over time
- [ ] Price suggestions based on cost

#### Inventory Alerts
- [ ] Low stock notifications
- [ ] Expiry date tracking
- [ ] Reorder reminders
- [ ] Par level settings (minimum stock threshold)

**Questions to resolve:**
- Track purchase history?
- Multiple prices per item (different stores)?
- Currency settings?

---

### Phase 6: Barcode & Product Lookup

#### Barcode Scanning
- [ ] Camera-based barcode scanner
- [ ] UPC database lookup
- [ ] Auto-fill product name/size
- [ ] Link to existing stock item or create new

#### Product Database
- [ ] Build local product database from scans
- [ ] Share product data across users?
- [ ] Manual product entry

**Questions to resolve:**
- Which UPC API to use?
- Offline mode for scanning?
- Handle unrecognized barcodes?

---

### Phase 7: Social & Sharing

#### Public Sharing
- [ ] Public bar profile page
- [ ] Shareable menu links
- [ ] Embed menu on other sites

#### Ratings & Favorites
- [ ] Rate drinks (personal ratings)
- [ ] Mark favorites
- [ ] "Want to try" list
- [ ] Guest ratings?

**Questions to resolve:**
- Public URL structure?
- Privacy settings?
- Social media sharing?

---

### Phase 8: UI/UX Improvements

#### Visual Enhancements
- [ ] Light/dark theme toggle
- [ ] Custom accent colors
- [ ] Improved bottle visualization
- [ ] Drink photos (user uploads)

#### Navigation
- [ ] Quick actions (floating button)
- [ ] Swipe gestures
- [ ] Keyboard shortcuts (desktop)
- [ ] Better search (filters, tags)

#### Mobile Optimization
- [ ] PWA with offline support
- [ ] Install prompts
- [ ] Push notifications

**Questions to resolve:**
- Primary device (phone/tablet/desktop)?
- Offline priority features?
- Notification preferences?

---

## Technical Debt & Improvements

### Performance
- [ ] Database indexing optimization
- [ ] Image caching/CDN
- [ ] Lazy loading for large lists

### Code Quality
- [ ] Add unit tests
- [ ] API documentation
- [ ] Type safety improvements

### Security
- [ ] Rate limiting
- [ ] Session management improvements
- [ ] Input validation audit

---

## User Decisions (Captured)

### Use Case
- **Primary use**: Home bar for entertaining guests + personal use
- **Target users**: Owner (barkeeper) + party guests

### Feature Preferences

| Feature | Decision |
|---------|----------|
| Drink tracking | Counter only ("Made 47 times"), no full history |
| Custom menus | Pull from "My Drinks" (imported recipes) |
| Misc ingredients | Simple count ("3 lemons"), NOT preventative for "can make" |
| Guest view | Menu + available drinks + request system |
| Drink requests | Prompt guest for their name when requesting |

### Pain Points Identified
1. **Auto-fill category when adding stock** - e.g., typing "Prosecco" should auto-suggest "Wine" category
2. **Category counts on filter tabs** - Show count badge next to each category (e.g., "Wine (3)")

---

## Quick Wins (Easy to implement)

These are small improvements that can be done quickly:

### Stock Page
- [ ] Category counts on filter tabs: "Wine (3)", "Spirits (8)"
- [ ] Auto-suggest category based on ingredient name (use CocktailDB ingredient data)
- [ ] Show "empty" badge on bottles at 0ml

### Browse Page
- [ ] Show "Already imported" badge if drink exists in My Drinks
- [ ] Batch import multiple drinks at once

### Drinks Page
- [ ] Sort by: Name, Times Made, Recently Added
- [ ] "Duplicate" button to copy a drink as template

### General
- [ ] Confirmation before destructive actions (delete)
- [ ] Undo for recent actions (toast with "Undo" button)
- [ ] Keyboard shortcut: "/" to focus search

---

## Notes & Ideas

_Space for capturing random ideas and feedback_

-
-
-

---

## Changelog

### v1.0 - Initial Release
- Basic stock and drink management
- CocktailDB and IBA integration
- Shopping list with low stock suggestions
- Owner/guest authentication
- Volume conversion (oz/cl/ml)
- Drink availability filtering
- Glass type icons
