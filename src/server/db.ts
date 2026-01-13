import { Database } from "bun:sqlite";

// Ensure data directory exists
const dataDir = "./data";
await Bun.write(`${dataDir}/.gitkeep`, "");

const db = new Database(`${dataDir}/bar.db`, { create: true });

// Enable WAL mode for better performance
db.exec("PRAGMA journal_mode = WAL");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS passcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('owner', 'guest')),
    code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    current_ml INTEGER NOT NULL DEFAULT 0,
    total_ml INTEGER NOT NULL DEFAULT 0,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    instructions TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS drink_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drink_id INTEGER NOT NULL,
    stock_id INTEGER,
    ingredient_name TEXT NOT NULL,
    amount_ml INTEGER,
    amount_text TEXT,
    optional INTEGER DEFAULT 0,
    FOREIGN KEY (drink_id) REFERENCES drinks(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS cocktaildb_drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    glass TEXT,
    instructions TEXT,
    image_path TEXT,
    image_url TEXT,
    ingredients_json TEXT,
    hidden INTEGER DEFAULT 0,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cocktaildb_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_name TEXT NOT NULL,
    stock_id INTEGER,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    suggested INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stock_id) REFERENCES stock(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS shopping_list_drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shopping_list_id INTEGER NOT NULL,
    drink_id INTEGER NOT NULL,
    FOREIGN KEY (shopping_list_id) REFERENCES shopping_list(id) ON DELETE CASCADE,
    FOREIGN KEY (drink_id) REFERENCES drinks(id) ON DELETE CASCADE,
    UNIQUE(shopping_list_id, drink_id)
  );

  CREATE TABLE IF NOT EXISTS iba_drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    glass TEXT,
    garnish TEXT,
    method TEXT,
    image_url TEXT,
    ingredients_json TEXT,
    hidden INTEGER DEFAULT 0,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default passcodes if none exist
const existingPasscodes = db.query("SELECT COUNT(*) as count FROM passcodes").get() as { count: number };
if (existingPasscodes.count === 0) {
  db.run("INSERT INTO passcodes (type, code) VALUES ('owner', '1234')");
  db.run("INSERT INTO passcodes (type, code) VALUES ('guest', '0000')");
  console.log("Default passcodes created: owner=1234, guest=0000");
}

// Migrate existing drink ingredients to cache (one-time)
const ingredientCount = db.query("SELECT COUNT(*) as count FROM cocktaildb_ingredients").get() as { count: number };
const drinkCount = db.query("SELECT COUNT(*) as count FROM cocktaildb_drinks").get() as { count: number };
if (ingredientCount.count === 0 && drinkCount.count > 0) {
  console.log("Migrating ingredients from cached drinks...");
  const drinks = db.query("SELECT ingredients_json FROM cocktaildb_drinks").all() as { ingredients_json: string }[];
  const seen = new Set<string>();
  for (const drink of drinks) {
    try {
      const ingredients = JSON.parse(drink.ingredients_json || "[]") as { name: string }[];
      for (const ing of ingredients) {
        if (ing.name && !seen.has(ing.name)) {
          seen.add(ing.name);
          db.run("INSERT OR IGNORE INTO cocktaildb_ingredients (name) VALUES (?)", [ing.name]);
        }
      }
    } catch {}
  }
  console.log(`Migrated ${seen.size} unique ingredients`);
}

// Add hidden column to cocktaildb_drinks if missing (migration)
try {
  db.run("ALTER TABLE cocktaildb_drinks ADD COLUMN hidden INTEGER DEFAULT 0");
  console.log("Added hidden column to cocktaildb_drinks");
} catch {
  // Column already exists
}

// Types
export interface Stock {
  id: number;
  name: string;
  category: string;
  current_ml: number;
  total_ml: number;
  image_path: string | null;
  created_at: string;
}

export interface Drink {
  id: number;
  name: string;
  category: string;
  instructions: string | null;
  image_path: string | null;
  created_at: string;
}

export interface DrinkIngredient {
  id: number;
  drink_id: number;
  stock_id: number | null;
  ingredient_name: string;
  amount_ml: number | null;
  amount_text: string | null;
  optional: number;
}

export interface CocktailDBDrink {
  id: number;
  external_id: string;
  name: string;
  category: string | null;
  glass: string | null;
  instructions: string | null;
  image_path: string | null;
  image_url: string | null;
  ingredients_json: string;
  hidden: number;
  scraped_at: string;
}

export interface Passcode {
  id: number;
  type: "owner" | "guest";
  code: string;
}

export interface ShoppingListItem {
  id: number;
  ingredient_name: string;
  stock_id: number | null;
  quantity: number;
  notes: string | null;
  suggested: number;
  created_at: string;
}

export interface ShoppingListDrink {
  id: number;
  shopping_list_id: number;
  drink_id: number;
}

export interface IBADrink {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  glass: string | null;
  garnish: string | null;
  method: string | null;
  image_url: string | null;
  ingredients_json: string;
  hidden: number;
  scraped_at: string;
}

export interface ShoppingListDrinkInfo {
  drink_id: number;
  name: string;
}

// Stock queries
export const stockQueries = {
  getAll: db.query<Stock, []>("SELECT * FROM stock ORDER BY category, name"),
  getById: db.query<Stock, [number]>("SELECT * FROM stock WHERE id = ?"),
  create: db.query<Stock, [string, string, number, number, string | null]>(
    "INSERT INTO stock (name, category, current_ml, total_ml, image_path) VALUES (?, ?, ?, ?, ?) RETURNING *"
  ),
  update: db.query<Stock, [string, string, number, number, string | null, number]>(
    "UPDATE stock SET name = ?, category = ?, current_ml = ?, total_ml = ?, image_path = ? WHERE id = ? RETURNING *"
  ),
  updateVolume: db.query<Stock, [number, number]>(
    "UPDATE stock SET current_ml = ? WHERE id = ? RETURNING *"
  ),
  delete: db.query<null, [number]>("DELETE FROM stock WHERE id = ?"),
};

// Drink queries
export const drinkQueries = {
  getAll: db.query<Drink, []>("SELECT * FROM drinks ORDER BY category, name"),
  getById: db.query<Drink, [number]>("SELECT * FROM drinks WHERE id = ?"),
  create: db.query<Drink, [string, string, string | null, string | null]>(
    "INSERT INTO drinks (name, category, instructions, image_path) VALUES (?, ?, ?, ?) RETURNING *"
  ),
  update: db.query<Drink, [string, string, string | null, string | null, number]>(
    "UPDATE drinks SET name = ?, category = ?, instructions = ?, image_path = ? WHERE id = ? RETURNING *"
  ),
  delete: db.query<null, [number]>("DELETE FROM drinks WHERE id = ?"),
};

// Drink ingredient queries
export const ingredientQueries = {
  getByDrinkId: db.query<DrinkIngredient, [number]>(
    "SELECT * FROM drink_ingredients WHERE drink_id = ?"
  ),
  create: db.query<DrinkIngredient, [number, number | null, string, number | null, string | null, number]>(
    "INSERT INTO drink_ingredients (drink_id, stock_id, ingredient_name, amount_ml, amount_text, optional) VALUES (?, ?, ?, ?, ?, ?) RETURNING *"
  ),
  deleteByDrinkId: db.query<null, [number]>("DELETE FROM drink_ingredients WHERE drink_id = ?"),
};

// Passcode queries
export const passcodeQueries = {
  getAll: db.query<Passcode, []>("SELECT * FROM passcodes"),
  getByType: db.query<Passcode, [string]>("SELECT * FROM passcodes WHERE type = ?"),
  validate: db.query<Passcode, [string]>("SELECT * FROM passcodes WHERE code = ?"),
  update: db.query<Passcode, [string, string]>(
    "UPDATE passcodes SET code = ? WHERE type = ? RETURNING *"
  ),
};

// CocktailDB queries
export const cocktailDBQueries = {
  getAll: db.query<CocktailDBDrink, []>("SELECT * FROM cocktaildb_drinks ORDER BY name"),
  search: db.query<CocktailDBDrink, [string]>(
    "SELECT * FROM cocktaildb_drinks WHERE name LIKE ? ORDER BY name LIMIT 50"
  ),
  getById: db.query<CocktailDBDrink, [number]>("SELECT * FROM cocktaildb_drinks WHERE id = ?"),
  getByExternalId: db.query<CocktailDBDrink, [string]>(
    "SELECT * FROM cocktaildb_drinks WHERE external_id = ?"
  ),
  getRandom: () => {
    const count = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM cocktaildb_drinks").get();
    if (!count || count.count === 0) return null;
    const offset = Math.floor(Math.random() * count.count);
    return db.query<CocktailDBDrink, []>(`SELECT * FROM cocktaildb_drinks LIMIT 1 OFFSET ${offset}`).get();
  },
  upsert: db.query<CocktailDBDrink, [string, string, string | null, string | null, string | null, string | null, string | null, string]>(
    `INSERT INTO cocktaildb_drinks (external_id, name, category, glass, instructions, image_path, image_url, ingredients_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(external_id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       glass = excluded.glass,
       instructions = excluded.instructions,
       image_url = excluded.image_url,
       ingredients_json = excluded.ingredients_json,
       scraped_at = CURRENT_TIMESTAMP
     RETURNING *`
  ),
  getCount: db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM cocktaildb_drinks"),
  getAllExternalIds: db.query<{ external_id: string }, []>("SELECT external_id FROM cocktaildb_drinks"),

  // Ingredient caching
  getAllIngredients: db.query<{ name: string }, []>(
    "SELECT name FROM cocktaildb_ingredients ORDER BY name"
  ),
  insertIngredient: db.query<null, [string]>(
    "INSERT OR IGNORE INTO cocktaildb_ingredients (name) VALUES (?)"
  ),
  getIngredientCount: db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM cocktaildb_ingredients"
  ),

  // Hide/show drinks
  toggleHidden: db.query<CocktailDBDrink, [number]>(
    "UPDATE cocktaildb_drinks SET hidden = NOT hidden WHERE id = ? RETURNING *"
  ),
};

// Shopping list queries
export const shoppingQueries = {
  getAll: db.query<ShoppingListItem, []>("SELECT * FROM shopping_list ORDER BY created_at DESC"),
  getById: db.query<ShoppingListItem, [number]>("SELECT * FROM shopping_list WHERE id = ?"),
  getByName: db.query<ShoppingListItem, [string]>(
    "SELECT * FROM shopping_list WHERE LOWER(ingredient_name) = LOWER(?)"
  ),
  getByStockId: db.query<ShoppingListItem, [number]>(
    "SELECT * FROM shopping_list WHERE stock_id = ?"
  ),
  create: db.query<ShoppingListItem, [string, number | null, number, string | null, number]>(
    "INSERT INTO shopping_list (ingredient_name, stock_id, quantity, notes, suggested) VALUES (?, ?, ?, ?, ?) RETURNING *"
  ),
  update: db.query<ShoppingListItem, [string, number | null, number, string | null, number]>(
    "UPDATE shopping_list SET ingredient_name = ?, stock_id = ?, quantity = ?, notes = ? WHERE id = ? RETURNING *"
  ),
  delete: db.query<null, [number]>("DELETE FROM shopping_list WHERE id = ?"),
  deleteAll: db.query<null, []>("DELETE FROM shopping_list"),

  // Junction table queries
  getDrinksByItemId: db.query<ShoppingListDrinkInfo, [number]>(`
    SELECT d.id as drink_id, d.name
    FROM shopping_list_drinks sld
    JOIN drinks d ON d.id = sld.drink_id
    WHERE sld.shopping_list_id = ?
  `),
  linkDrink: db.query<ShoppingListDrink, [number, number]>(
    "INSERT OR IGNORE INTO shopping_list_drinks (shopping_list_id, drink_id) VALUES (?, ?) RETURNING *"
  ),
  unlinkDrink: db.query<null, [number, number]>(
    "DELETE FROM shopping_list_drinks WHERE shopping_list_id = ? AND drink_id = ?"
  ),

  // Low stock suggestions
  getLowStock: db.query<Stock & { percentage: number }, []>(`
    SELECT *, CAST(current_ml AS REAL) / total_ml * 100 as percentage
    FROM stock
    WHERE total_ml > 0 AND CAST(current_ml AS REAL) / total_ml <= 0.25
    ORDER BY CAST(current_ml AS REAL) / total_ml ASC
  `),
};

// IBA cocktail queries
export const ibaQueries = {
  getAll: db.query<IBADrink, []>("SELECT * FROM iba_drinks ORDER BY name"),
  search: db.query<IBADrink, [string]>(
    "SELECT * FROM iba_drinks WHERE name LIKE ? ORDER BY name LIMIT 50"
  ),
  getById: db.query<IBADrink, [number]>("SELECT * FROM iba_drinks WHERE id = ?"),
  getBySlug: db.query<IBADrink, [string]>("SELECT * FROM iba_drinks WHERE slug = ?"),
  getRandom: () => {
    const count = db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM iba_drinks").get();
    if (!count || count.count === 0) return null;
    const offset = Math.floor(Math.random() * count.count);
    return db.query<IBADrink, []>(`SELECT * FROM iba_drinks LIMIT 1 OFFSET ${offset}`).get();
  },
  upsert: db.query<IBADrink, [string, string, string | null, string | null, string | null, string | null, string | null, string]>(
    `INSERT INTO iba_drinks (slug, name, category, glass, garnish, method, image_url, ingredients_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       glass = excluded.glass,
       garnish = excluded.garnish,
       method = excluded.method,
       image_url = excluded.image_url,
       ingredients_json = excluded.ingredients_json,
       scraped_at = CURRENT_TIMESTAMP
     RETURNING *`
  ),
  getCount: db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM iba_drinks"),
  getAllSlugs: db.query<{ slug: string }, []>("SELECT slug FROM iba_drinks"),
  toggleHidden: db.query<IBADrink, [number]>(
    "UPDATE iba_drinks SET hidden = NOT hidden WHERE id = ? RETURNING *"
  ),
};

export { db };
