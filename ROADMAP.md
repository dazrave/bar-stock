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

#### Menu Management (Owner)
- [ ] Create multiple named menus (e.g., "House Favorites", "Non-Alcoholic", "Summer Drinks")
- [ ] Add drinks from "My Drinks" to menus (must import first)
- [ ] Reorder drinks within menus (drag & drop)
- [ ] Menu descriptions/headers
- [ ] **Show/hide entire menus** - toggle menu visibility
- [ ] **Show/hide individual drinks** - toggle per drink per menu

#### Menu Display Rules
| Viewer | Menu Visibility | Drink Visibility |
|--------|-----------------|------------------|
| Owner | Sees all menus (active + inactive) | Sees all drinks (hidden shown as ghosted) |
| Guest | Only sees active menus | Only sees: visible drinks + can make |

**Key rule**: If a drink can't be made (missing ingredients), it's NEVER shown to guests, even if "visible" is checked.

#### Owner Menu View
- [ ] Toggle menu active/inactive
- [ ] Per-drink toggles: "Show on this menu" / "Hide from this menu"
- [ ] Badge showing "X hidden" and "X unavailable"

#### Database
```sql
CREATE TABLE menus (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER DEFAULT 1,  -- shown to guests?
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE menu_drinks (
  menu_id INTEGER,
  drink_id INTEGER,  -- references drinks table (My Drinks)
  sort_order INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0  -- manually hidden by owner
);
```

**Decided**: Menus contain drinks from "My Drinks" only. Unavailable drinks auto-hidden from guests.

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
- [ ] Nav item with badge count for pending requests
- [ ] Queue shows: Guest Name | Drink | Time requested
- [ ] Actions: "Making" (in progress) | "Done" (auto-deducts stock, increments counter)
- [ ] Optional: "Decline" with reason
- [ ] **Queue toggle**: "Taking Orders" / "Bar Closed" switch
  - When closed: Guests see "Bar is closed" message, can't request

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

#### Navigation by Role
| Role | Nav Items |
|------|-----------|
| Owner | Stock, Drinks, Browse, Menus, Queue, Shopping, Settings |
| Guest | Menu, Queue (sees all requests with names, can order for others) |

**Note**: Guests use same shared passcode for simplicity. Queue shows everyone's requests so guests can order on behalf of others (e.g., "Sarah wants a Margarita").

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
| Stock deduction | Always automatic when marking drink "Done" |
| Queue notifications | Badge count on nav item only (no sounds/popups) |
| Queue control | Toggle: "Taking Orders" / "Bar Closed" |
| Import policy | Allow all imports, hide unmakeable from guests |

### Pain Points Identified
1. **Auto-fill category when adding stock** - e.g., typing "Prosecco" should auto-suggest "Wine" category
2. **Category counts on filter tabs** - Show count badge next to each category (e.g., "Wine (3)")
3. **BUG: Can add drinks to menu without stock** - Should hide from guests, show warning for owner
4. **BUG: IBA sync broken** - Images blocked, ingredients and instructions not being scraped (regex patterns need fixing)

---

## Quick Wins (Easy to implement)

These are small improvements that can be done quickly:

### Stock Page
- [ ] Category counts on filter tabs: "Wine (3)", "Spirits (8)"
- [ ] Smart category auto-fill (layered approach):
  1. **Static mapping** - Common ingredients → categories (instant)
  2. **CocktailDB lookup** - Fetch category from API if not in static map
  3. **Learn from history** - Remember user's past category choices per ingredient
- [ ] Show "empty" badge on bottles at 0ml
- [ ] Default categories: Spirits, Wine, Beer, Liqueurs, Mixers, Juice, Fruit, Bitters, Syrups, Garnishes, Other

### Browse Page
- [ ] Show "Already imported" badge if drink exists in My Drinks
- [ ] Batch import multiple drinks at once
- [ ] **Import behavior** (decided):
  - Allow importing ANY drink (no blocking)
  - Drinks you can't make: hidden from guests, warning badge for owner
  - Missing ingredients shown on drink detail

### Drinks Page
- [ ] Sort by: Name, Times Made, Recently Added
- [ ] "Duplicate" button to copy a drink as template

### General
- [ ] Confirmation before destructive actions (delete)
- [ ] Undo for recent actions (toast with "Undo" button)
- [ ] Keyboard shortcut: "/" to focus search

---

## Known Bugs (To Fix)

### HIGH PRIORITY
1. **IBA Scraper Broken**
   - Images not loading (possible hotlink protection)
   - Ingredients not being parsed
   - Instructions/method not being extracted
   - **Root cause**: Regex patterns too complex, HTML structure is simpler:
     ```html
     <!-- Ingredients are simple <ul><li> -->
     <ul>
       <li>50 ml Tequila 100% Agave</li>
       <li>20 ml Triple Sec</li>
     </ul>

     <!-- Method is <p> tags -->
     <p>Add all ingredients into a shaker with ice.</p>
     <p>Shake and strain into a chilled cocktail glass.</p>

     <!-- Garnish is <p> after garnish heading -->
     <p>Half salt rim (Optional).</p>
     ```
   - **Fix needed**: Simplify regex, look for content between section headers
   - **Image fix**: May need to download images to local storage instead of hotlinking

2. **Drinks Page Shows Unmakeable**
   - Imported drinks show even without ingredients
   - Should be hidden from guests, ghosted for owner

### MEDIUM PRIORITY
3. **No feedback when sync fails**
   - If IBA sync has errors, user doesn't see details

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
