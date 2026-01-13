import React, { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { formatMeasureWithMl, formatVolume } from "../utils/volume";

interface CocktailDBDrink {
  id: number;
  external_id: string;
  name: string;
  category: string | null;
  glass: string | null;
  instructions: string | null;
  image_url: string | null;
  ingredients_json: string;
}

interface StockItem {
  id: number;
  name: string;
  current_ml: number;
  total_ml: number;
}

export function Browse() {
  const [drinks, setDrinks] = useState<CocktailDBDrink[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<CocktailDBDrink | null>(null);
  const [importing, setImporting] = useState<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchCount();
    // Fetch stock for ingredient matching
    fetch("/api/stock")
      .then((r) => r.json())
      .then(setStock)
      .catch(() => {});
  }, []);

  const fetchCount = async () => {
    const res = await fetch("/api/cocktaildb/count");
    const data = await res.json();
    setCount(data.count);
  };

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) {
      setDrinks([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/cocktaildb/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setDrinks(data);
    } catch (err) {
      showToast("Search failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRandom = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cocktaildb/random");
      const data = await res.json();
      if (data) {
        setSelectedDrink(data);
      } else {
        showToast("No drinks in cache. Sync first!", "error");
      }
    } catch (err) {
      showToast("Failed to get random drink", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm("This will fetch drinks from CocktailDB (skips existing). Continue?")) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/cocktaildb/sync", { method: "POST" });
      const data = await res.json();
      if (data.synced > 0) {
        showToast(`Added ${data.synced} new drinks!${data.skipped > 0 ? ` (${data.skipped} already cached)` : ""}`);
      } else if (data.skipped > 0) {
        showToast(`All ${data.skipped} drinks already cached`);
      } else {
        showToast("No new drinks found");
      }
      fetchCount();
    } catch (err) {
      showToast("Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (drink: CocktailDBDrink) => {
    setImporting(drink.id);
    try {
      const res = await fetch(`/api/cocktaildb/import/${drink.id}`, { method: "POST" });
      if (res.ok) {
        showToast(`${drink.name} added to your drinks!`);
        setSelectedDrink(null);
      } else {
        showToast("Import failed", "error");
      }
    } catch (err) {
      showToast("Import failed", "error");
    } finally {
      setImporting(null);
    }
  };

  const parseIngredients = (json: string): Array<{ name: string; measure: string }> => {
    try {
      return JSON.parse(json) || [];
    } catch {
      return [];
    }
  };

  // Find matching stock item by name (case insensitive, partial match)
  const findStockMatch = (ingredientName: string): StockItem | undefined => {
    const lower = ingredientName.toLowerCase();
    return stock.find(
      (s) =>
        s.name.toLowerCase() === lower ||
        s.name.toLowerCase().includes(lower) ||
        lower.includes(s.name.toLowerCase())
    );
  };

  const handleAddToShoppingList = async (ingredientName: string) => {
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient_name: ingredientName }),
      });

      if (res.status === 409) {
        showToast(`${ingredientName} already in shopping list`);
      } else if (res.ok) {
        showToast(`Added ${ingredientName} to shopping list`);
      } else {
        showToast("Failed to add", "error");
      }
    } catch (err) {
      showToast("Failed to add", "error");
    }
  };

  return (
    <div className="page">
      <div className="header">
        <h1>Browse</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync DB"}
        </button>
      </div>

      <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
        {count > 0 ? `${count} cocktails cached locally` : "No drinks cached yet. Click 'Sync DB' to fetch from CocktailDB."}
      </p>

      <div className="search-container">
        <span className="search-icon">🔍</span>
        <input
          className="input search-input"
          placeholder="Search cocktails..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <button
        className="btn btn-secondary"
        style={{ width: "100%", marginBottom: "1rem" }}
        onClick={handleRandom}
        disabled={loading || count === 0}
      >
        🎲 Random Drink
      </button>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && drinks.length > 0 && (
        <div className="grid grid-2">
          {drinks.map((drink) => (
            <div
              key={drink.id}
              className="card"
              onClick={() => setSelectedDrink(drink)}
              style={{ cursor: "pointer" }}
            >
              {drink.image_url && (
                <img
                  src={drink.image_url}
                  alt={drink.name}
                  className="drink-image"
                  style={{ marginBottom: "0.75rem" }}
                />
              )}
              <div style={{ fontWeight: 600 }}>{drink.name}</div>
              {drink.category && (
                <div className="badge" style={{ marginTop: "0.5rem" }}>{drink.category}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && search.length >= 2 && drinks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No drinks found for "{search}"</p>
        </div>
      )}

      {selectedDrink && (
        <div className="modal-overlay" onClick={() => setSelectedDrink(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {selectedDrink.image_url && (
              <img
                src={selectedDrink.image_url}
                alt={selectedDrink.name}
                className="drink-image"
                style={{ marginBottom: "1rem" }}
              />
            )}
            <h2 className="modal-title">{selectedDrink.name}</h2>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {selectedDrink.category && <div className="badge">{selectedDrink.category}</div>}
              {selectedDrink.glass && <div className="badge">{selectedDrink.glass}</div>}
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                INGREDIENTS
              </h3>
              {parseIngredients(selectedDrink.ingredients_json).map((ing, i) => {
                const stockMatch = findStockMatch(ing.name);
                const hasStock = stockMatch && stockMatch.current_ml > 0;
                const percentage = stockMatch
                  ? Math.round((stockMatch.current_ml / stockMatch.total_ml) * 100)
                  : 0;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.75rem 0",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>{ing.name}</span>
                        {stockMatch && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "9999px",
                              background: hasStock
                                ? percentage > 25
                                  ? "rgba(34, 197, 94, 0.2)"
                                  : "rgba(234, 179, 8, 0.2)"
                                : "rgba(239, 68, 68, 0.2)",
                              color: hasStock
                                ? percentage > 25
                                  ? "var(--success)"
                                  : "var(--warning)"
                                : "var(--danger)",
                            }}
                          >
                            {hasStock ? `${formatVolume(stockMatch.current_ml)} (${percentage}%)` : "Empty"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        {formatMeasureWithMl(ing.measure)}
                      </div>
                    </div>
                    {!stockMatch && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
                        onClick={() => handleAddToShoppingList(ing.name)}
                      >
                        + Shop
                      </button>
                    )}
                    {stockMatch && !hasStock && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
                        onClick={() => handleAddToShoppingList(ing.name)}
                      >
                        + Shop
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedDrink.instructions && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                  INSTRUCTIONS
                </h3>
                <p style={{ lineHeight: 1.6 }}>{selectedDrink.instructions}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setSelectedDrink(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => handleImport(selectedDrink)}
                disabled={importing === selectedDrink.id}
              >
                {importing === selectedDrink.id ? "Adding..." : "+ Add to Drinks"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
