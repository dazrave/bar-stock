import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { serveStatic } from "hono/bun";
import {
  stockQueries,
  drinkQueries,
  ingredientQueries,
  passcodeQueries,
  cocktailDBQueries,
  shoppingQueries,
  type Stock,
  type ShoppingListItem,
} from "./db";

const app = new Hono();

// CORS for development
app.use("/api/*", cors());

// Session helper
const getSession = (c: any): { type: "owner" | "guest" } | null => {
  const session = getCookie(c, "session");
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
};

// Auth middleware
const requireAuth = (allowGuest = false) => {
  return async (c: any, next: any) => {
    const session = getSession(c);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!allowGuest && session.type !== "owner") {
      return c.json({ error: "Owner access required" }, 403);
    }
    c.set("session", session);
    await next();
  };
};

// ============ AUTH ROUTES ============

app.post("/api/auth", async (c) => {
  const { code } = await c.req.json();
  const passcode = passcodeQueries.validate.get(code);

  if (!passcode) {
    return c.json({ error: "Invalid passcode" }, 401);
  }

  setCookie(c, "session", JSON.stringify({ type: passcode.type }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return c.json({ type: passcode.type });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, "session");
  return c.json({ success: true });
});

app.get("/api/session", (c) => {
  const session = getSession(c);
  return c.json(session || { type: null });
});

// ============ STOCK ROUTES ============

app.get("/api/stock", requireAuth(true), (c) => {
  const stock = stockQueries.getAll.all();
  return c.json(stock);
});

app.post("/api/stock", requireAuth(), async (c) => {
  const { name, category, current_ml, total_ml, image_path } = await c.req.json();
  const stock = stockQueries.create.get(name, category || "Other", current_ml || 0, total_ml || 0, image_path || null);
  return c.json(stock, 201);
});

app.put("/api/stock/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { name, category, current_ml, total_ml, image_path } = await c.req.json();
  const stock = stockQueries.update.get(name, category, current_ml, total_ml, image_path || null, id);
  if (!stock) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(stock);
});

app.patch("/api/stock/:id/volume", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { current_ml } = await c.req.json();
  const stock = stockQueries.updateVolume.get(current_ml, id);
  if (!stock) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json(stock);
});

app.delete("/api/stock/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  stockQueries.delete.run(id);
  return c.json({ success: true });
});

// ============ DRINKS ROUTES ============

app.get("/api/drinks", requireAuth(true), (c) => {
  const drinks = drinkQueries.getAll.all();
  const drinksWithIngredients = drinks.map((drink) => ({
    ...drink,
    ingredients: ingredientQueries.getByDrinkId.all(drink.id),
  }));
  return c.json(drinksWithIngredients);
});

app.get("/api/drinks/:id", requireAuth(true), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(id);
  if (!drink) {
    return c.json({ error: "Not found" }, 404);
  }
  const ingredients = ingredientQueries.getByDrinkId.all(id);
  return c.json({ ...drink, ingredients });
});

app.post("/api/drinks", requireAuth(), async (c) => {
  const { name, category, instructions, image_path, ingredients } = await c.req.json();
  const drink = drinkQueries.create.get(name, category || "Other", instructions || null, image_path || null);

  if (drink && ingredients?.length) {
    for (const ing of ingredients) {
      ingredientQueries.create.run(
        drink.id,
        ing.stock_id || null,
        ing.ingredient_name,
        ing.amount_ml || null,
        ing.amount_text || null,
        ing.optional ? 1 : 0
      );
    }
  }

  const savedIngredients = drink ? ingredientQueries.getByDrinkId.all(drink.id) : [];
  return c.json({ ...drink, ingredients: savedIngredients }, 201);
});

app.put("/api/drinks/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { name, category, instructions, image_path, ingredients } = await c.req.json();

  const drink = drinkQueries.update.get(name, category, instructions || null, image_path || null, id);
  if (!drink) {
    return c.json({ error: "Not found" }, 404);
  }

  ingredientQueries.deleteByDrinkId.run(id);
  if (ingredients?.length) {
    for (const ing of ingredients) {
      ingredientQueries.create.run(
        id,
        ing.stock_id || null,
        ing.ingredient_name,
        ing.amount_ml || null,
        ing.amount_text || null,
        ing.optional ? 1 : 0
      );
    }
  }

  const savedIngredients = ingredientQueries.getByDrinkId.all(id);
  return c.json({ ...drink, ingredients: savedIngredients });
});

app.delete("/api/drinks/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  drinkQueries.delete.run(id);
  return c.json({ success: true });
});

app.post("/api/drinks/:id/make", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(id);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }

  const ingredients = ingredientQueries.getByDrinkId.all(id);
  const updatedStock: Stock[] = [];

  for (const ing of ingredients) {
    if (ing.stock_id && ing.amount_ml) {
      const stock = stockQueries.getById.get(ing.stock_id);
      if (stock) {
        const newAmount = Math.max(0, stock.current_ml - ing.amount_ml);
        const updated = stockQueries.updateVolume.get(newAmount, ing.stock_id);
        if (updated) updatedStock.push(updated);
      }
    }
  }

  return c.json({ success: true, updatedStock });
});

// ============ SETTINGS ROUTES ============

app.get("/api/settings", requireAuth(), (c) => {
  const passcodes = passcodeQueries.getAll.all();
  return c.json({ passcodes });
});

app.put("/api/settings/passcode", requireAuth(), async (c) => {
  const { type, code } = await c.req.json();
  if (!["owner", "guest"].includes(type)) {
    return c.json({ error: "Invalid type" }, 400);
  }
  if (!code || code.length < 4) {
    return c.json({ error: "Code must be at least 4 characters" }, 400);
  }
  const updated = passcodeQueries.update.get(code, type);
  return c.json(updated);
});

// ============ COCKTAILDB ROUTES ============

app.get("/api/cocktaildb/search", requireAuth(true), (c) => {
  const q = c.req.query("q") || "";
  const drinks = cocktailDBQueries.search.all(`%${q}%`);
  return c.json(drinks);
});

app.get("/api/cocktaildb/random", requireAuth(true), (c) => {
  const drink = cocktailDBQueries.getRandom();
  return c.json(drink);
});

app.get("/api/cocktaildb/count", requireAuth(true), (c) => {
  const result = cocktailDBQueries.getCount.get();
  return c.json({ count: result?.count || 0 });
});

app.post("/api/cocktaildb/import/:id", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const cocktailDBDrink = cocktailDBQueries.getById.get(id);

  if (!cocktailDBDrink) {
    return c.json({ error: "Drink not found in cache" }, 404);
  }

  let ingredients: Array<{ name: string; measure: string }> = [];
  try {
    ingredients = JSON.parse(cocktailDBDrink.ingredients_json || "[]");
  } catch {}

  const drink = drinkQueries.create.get(
    cocktailDBDrink.name,
    cocktailDBDrink.category || "Other",
    cocktailDBDrink.instructions,
    cocktailDBDrink.image_url // Use the URL as image path
  );

  if (drink) {
    for (const ing of ingredients) {
      ingredientQueries.create.run(
        drink.id,
        null,
        ing.name,
        null,
        ing.measure || null,
        0
      );
    }
  }

  const savedIngredients = drink ? ingredientQueries.getByDrinkId.all(drink.id) : [];
  return c.json({ ...drink, ingredients: savedIngredients }, 201);
});

app.post("/api/cocktaildb/sync", requireAuth(), async (c) => {
  const API_KEY = "1";
  const baseUrl = "https://www.thecocktaildb.com/api/json/v1";

  // Get existing external IDs to skip
  const existingIds = new Set(
    cocktailDBQueries.getAllExternalIds.all().map((r) => r.external_id)
  );

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");

  for (const letter of letters) {
    try {
      const res = await fetch(`${baseUrl}/${API_KEY}/search.php?f=${letter}`);
      const data = (await res.json()) as { drinks: any[] | null };

      if (data.drinks) {
        for (const d of data.drinks) {
          // Skip if we already have this drink
          if (existingIds.has(d.idDrink)) {
            skipped++;
            continue;
          }

          const ingredients: Array<{ name: string; measure: string }> = [];
          for (let i = 1; i <= 15; i++) {
            const name = d[`strIngredient${i}`];
            const measure = d[`strMeasure${i}`];
            if (name && name.trim()) {
              ingredients.push({ name: name.trim(), measure: measure?.trim() || "" });
            }
          }

          cocktailDBQueries.upsert.run(
            d.idDrink,
            d.strDrink,
            d.strCategory,
            d.strGlass,
            d.strInstructions,
            null,
            d.strDrinkThumb,
            JSON.stringify(ingredients)
          );

          // Cache ingredients
          for (const ing of ingredients) {
            if (ing.name) {
              cocktailDBQueries.insertIngredient.run(ing.name);
            }
          }

          synced++;
        }
      }
    } catch (err) {
      errors.push(`Letter ${letter}: ${err}`);
    }
  }

  return c.json({ synced, skipped, errors: errors.length > 0 ? errors : undefined });
});

// Get cached ingredients from CocktailDB for autocomplete
app.get("/api/cocktaildb/ingredients", requireAuth(true), (c) => {
  const ingredients = cocktailDBQueries.getAllIngredients.all();
  return c.json(ingredients.map((i) => i.name));
});

// Toggle hidden status on a cocktaildb drink
app.post("/api/cocktaildb/:id/toggle-hidden", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  const drink = cocktailDBQueries.toggleHidden.get(id);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }
  return c.json(drink);
});

// ============ SHOPPING LIST ROUTES ============

// Get all shopping list items with linked drinks
app.get("/api/shopping", requireAuth(), (c) => {
  const items = shoppingQueries.getAll.all();
  const itemsWithDrinks = items.map((item) => ({
    ...item,
    drinks: shoppingQueries.getDrinksByItemId.all(item.id),
  }));
  return c.json(itemsWithDrinks);
});

// Add item to shopping list
app.post("/api/shopping", requireAuth(), async (c) => {
  const { ingredient_name, stock_id, quantity, notes, suggested } = await c.req.json();

  // Check if already exists
  const existing = shoppingQueries.getByName.get(ingredient_name);
  if (existing) {
    return c.json({ error: "Item already in shopping list", existing }, 409);
  }

  const item = shoppingQueries.create.get(
    ingredient_name,
    stock_id || null,
    quantity || 1,
    notes || null,
    suggested ? 1 : 0
  );
  return c.json(item, 201);
});

// Delete shopping list item
app.delete("/api/shopping/:id", requireAuth(), (c) => {
  const id = parseInt(c.req.param("id"));
  shoppingQueries.delete.run(id);
  return c.json({ success: true });
});

// Mark item as bought - add to stock
app.post("/api/shopping/:id/bought", requireAuth(), async (c) => {
  const id = parseInt(c.req.param("id"));
  const { total_ml, category } = await c.req.json();

  const item = shoppingQueries.getById.get(id);
  if (!item) {
    return c.json({ error: "Not found" }, 404);
  }

  // If linked to existing stock, refill it
  if (item.stock_id) {
    const stock = stockQueries.getById.get(item.stock_id);
    if (stock) {
      const newTotal = total_ml || stock.total_ml;
      stockQueries.update.get(
        stock.name,
        stock.category,
        newTotal, // current = full
        newTotal,
        stock.image_path,
        stock.id
      );
      shoppingQueries.delete.run(id);
      return c.json({ action: "refilled", stockId: item.stock_id, stock });
    }
  }

  // If not linked, need bottle size to create stock
  if (!total_ml) {
    return c.json({ action: "needs_size", itemId: id, item });
  }

  // Create new stock item
  const newStock = stockQueries.create.get(
    item.ingredient_name,
    category || "Other",
    total_ml,
    total_ml,
    null
  );

  shoppingQueries.delete.run(id);
  return c.json({ action: "created", stock: newStock });
});

// Mark all items as bought
app.post("/api/shopping/bought-all", requireAuth(), async (c) => {
  const { items } = await c.req.json(); // Array of { id, total_ml?, category? }
  const results: Array<{ id: number; action: string; stock?: Stock }> = [];

  for (const { id, total_ml, category } of items) {
    const item = shoppingQueries.getById.get(id);
    if (!item) continue;

    if (item.stock_id) {
      const stock = stockQueries.getById.get(item.stock_id);
      if (stock) {
        const newTotal = total_ml || stock.total_ml;
        stockQueries.update.get(
          stock.name,
          stock.category,
          newTotal,
          newTotal,
          stock.image_path,
          stock.id
        );
        shoppingQueries.delete.run(id);
        results.push({ id, action: "refilled", stock });
        continue;
      }
    }

    if (total_ml) {
      const newStock = stockQueries.create.get(
        item.ingredient_name,
        category || "Other",
        total_ml,
        total_ml,
        null
      );
      shoppingQueries.delete.run(id);
      results.push({ id, action: "created", stock: newStock! });
    } else {
      results.push({ id, action: "needs_size" });
    }
  }

  return c.json({ results });
});

// Get low stock suggestions
app.get("/api/shopping/suggestions", requireAuth(), (c) => {
  const lowStock = shoppingQueries.getLowStock.all();

  // For each low-stock item, find drinks that use it
  const suggestions = lowStock.map((stock) => {
    const drinks = ingredientQueries.getByDrinkId
      ? [] // We need a different query for this
      : [];
    return {
      ...stock,
      drinks,
    };
  });

  return c.json(suggestions);
});

// Add suggestions to shopping list
app.post("/api/shopping/add-suggestions", requireAuth(), async (c) => {
  const { stockIds } = await c.req.json(); // Array of stock IDs to add

  const added: ShoppingListItem[] = [];
  for (const stockId of stockIds) {
    const stock = stockQueries.getById.get(stockId);
    if (!stock) continue;

    // Check if already in shopping list
    const existing = shoppingQueries.getByStockId.get(stockId);
    if (existing) continue;

    const item = shoppingQueries.create.get(
      stock.name,
      stockId,
      1,
      null,
      1 // suggested = true
    );
    if (item) added.push(item);
  }

  return c.json({ added });
});

// Add missing ingredients from a drink to shopping list
app.post("/api/shopping/from-drink/:id", requireAuth(), async (c) => {
  const drinkId = parseInt(c.req.param("id"));
  const drink = drinkQueries.getById.get(drinkId);
  if (!drink) {
    return c.json({ error: "Drink not found" }, 404);
  }

  const ingredients = ingredientQueries.getByDrinkId.all(drinkId);
  const added: ShoppingListItem[] = [];

  for (const ing of ingredients) {
    // Check if ingredient needs to be added
    let needsAdding = false;

    if (!ing.stock_id) {
      // Not linked to any stock - add it
      needsAdding = true;
    } else {
      // Linked to stock - check if empty or low
      const stockItem = stockQueries.getById.get(ing.stock_id);
      if (!stockItem || stockItem.current_ml === 0) {
        needsAdding = true;
      }
    }

    if (needsAdding) {
      // Check if already in shopping list
      const existing = shoppingQueries.getByName.get(ing.ingredient_name);
      if (existing) {
        // Just link the drink to existing item
        shoppingQueries.linkDrink.run(existing.id, drinkId);
      } else {
        // Create new shopping list item
        const item = shoppingQueries.create.get(
          ing.ingredient_name,
          ing.stock_id,
          1,
          null,
          0 // not suggested
        );
        if (item) {
          shoppingQueries.linkDrink.run(item.id, drinkId);
          added.push(item);
        }
      }
    }
  }

  return c.json({ added, drinkName: drink.name });
});

// ============ UPLOAD ROUTES ============

app.post("/api/upload", requireAuth(), async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `./data/uploads/${filename}`;

  await Bun.write(path, file);

  return c.json({ path: `/uploads/${filename}` });
});

// Serve uploaded files
app.get("/uploads/*", async (c) => {
  const filepath = `./data${c.req.path}`;
  const file = Bun.file(filepath);

  if (!(await file.exists())) {
    return c.json({ error: "Not found" }, 404);
  }

  return new Response(file);
});

// Export for use with Bun.serve
export { app };

// Start server with Bun.serve for HTML support
const port = parseInt(process.env.PORT || "3000");

// Import the HTML file for Bun's bundler
import homepage from "../client/index.html";

const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  // Use routes for the HTML bundle
  routes: {
    "/": homepage,
    "/stock": homepage,
    "/drinks": homepage,
    "/browse": homepage,
    "/menu": homepage,
    "/settings": homepage,
    "/shopping": homepage,
  },
  async fetch(req) {
    const url = new URL(req.url);

    // API routes handled by Hono
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) {
      return app.fetch(req);
    }

    // Fallback: serve HTML for SPA routes
    return new Response(Bun.file("./src/client/index.html"), {
      headers: { "Content-Type": "text/html" },
    });
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`
  🍸 BarStock running at http://localhost:${port}

  Default passcodes:
    Owner: 1234
    Guest: 0000
`);
