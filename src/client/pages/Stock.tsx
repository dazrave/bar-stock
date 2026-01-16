import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bottle } from "../components/Bottle";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { parseVolume, formatVolume } from "../utils/volume";
import { suggestCategory, STOCK_CATEGORIES } from "../utils/categoryMapping";

interface StockItem {
  id: number;
  name: string;
  category: string;
  current_ml: number;
  total_ml: number;
  total_used_ml: number;
  unit_type: "ml" | "count";
  image_path: string | null;
  aliases: string | null;
}

interface StockDrink {
  drink_id: number;
  drink_name: string;
  drink_category: string;
  on_menu: number;
}

interface UnavailableDrink {
  id: number;
  name: string;
  category: string;
  instructions: string | null;
  description: string | null;
  image_path: string | null;
  missingIngredients: string[];
  ingredients: Array<{
    name: string;
    amount: string | null;
    optional: boolean;
    stock_id: number | null;
  }>;
}

const CATEGORIES = STOCK_CATEGORIES;

export function Stock() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [filter, setFilter] = useState("All");
  const [shoppingList, setShoppingList] = useState<{ stock_id: number | null; ingredient_name: string }[]>([]);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "empty" | "full" | "size-big" | "size-small">("name");
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditValue, setQuickEditValue] = useState("");
  const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>([]);
  const { showToast } = useToast();
  const { session } = useAuth();
  const isOwner = session?.type === "owner";

  // New state for drinks by stock item
  const [expandedStockId, setExpandedStockId] = useState<number | null>(null);
  const [stockDrinks, setStockDrinks] = useState<Record<number, StockDrink[]>>({});
  const [drinkCounts, setDrinkCounts] = useState<Record<number, number>>({});
  const [unavailableDrinks, setUnavailableDrinks] = useState<UnavailableDrink[]>([]);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<UnavailableDrink | null>(null);

  // Form state - using strings to allow flexible input
  const [formData, setFormData] = useState({
    name: "",
    category: "Spirits",
    total_input: "700ml",
    current_input: "700ml",
    unit_type: "ml" as "ml" | "count",
    aliases: "",
  });

  useEffect(() => {
    fetchStock();
    fetchUnavailableDrinks();
    // Fetch ingredient suggestions for autocomplete
    fetch("/api/cocktaildb/ingredients")
      .then((r) => r.json())
      .then(setIngredientSuggestions)
      .catch(() => {}); // Silently fail - autocomplete is optional
    // Fetch shopping list to show indicators
    fetch("/api/shopping")
      .then((r) => r.json())
      .then((data) => setShoppingList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchUnavailableDrinks = async () => {
    try {
      const res = await fetch("/api/drinks/unavailable");
      const data = await res.json();
      setUnavailableDrinks(data);
    } catch (err) {
      // Silently fail
    }
  };

  const fetchDrinksForStock = async (stockId: number) => {
    if (stockDrinks[stockId]) {
      // Already fetched
      return;
    }
    try {
      const res = await fetch(`/api/stock/${stockId}/drinks`);
      const data = await res.json();
      setStockDrinks((prev) => ({ ...prev, [stockId]: data }));
      setDrinkCounts((prev) => ({ ...prev, [stockId]: data.length }));
    } catch (err) {
      // Silently fail
    }
  };

  const toggleExpanded = async (stockId: number) => {
    if (expandedStockId === stockId) {
      setExpandedStockId(null);
    } else {
      setExpandedStockId(stockId);
      await fetchDrinksForStock(stockId);
    }
  };

  const fetchStock = async () => {
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      setStock(data);
    } catch (err) {
      showToast("Failed to load stock", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ name: "", category: "Spirits", total_input: "700ml", current_input: "700ml", unit_type: "ml", aliases: "" });
    setShowModal(true);
  };

  const handleEdit = (item: StockItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      total_input: item.unit_type === "count" ? `${item.total_ml}` : `${item.total_ml}ml`,
      current_input: item.unit_type === "count" ? `${item.current_ml}` : `${item.current_ml}ml`,
      unit_type: item.unit_type || "ml",
      aliases: item.aliases || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    let total_ml: number;
    let current_ml: number | null;

    if (formData.unit_type === "count") {
      // For count-based items, parse as plain integers
      total_ml = parseInt(formData.total_input) || 0;
      current_ml = parseInt(formData.current_input) || 0;
      if (total_ml <= 0) {
        showToast("Invalid total count", "error");
        return;
      }
      if (current_ml < 0) {
        showToast("Invalid current count", "error");
        return;
      }
    } else {
      // For ml-based items, use volume parser
      total_ml = parseVolume(formData.total_input) || 0;
      if (total_ml <= 0) {
        showToast("Invalid bottle size", "error");
        return;
      }
      current_ml = parseVolume(formData.current_input, total_ml);
      if (current_ml === null || current_ml < 0) {
        showToast("Invalid current amount", "error");
        return;
      }
    }

    const payload = {
      name: formData.name,
      category: formData.category,
      total_ml,
      current_ml: Math.min(current_ml, total_ml),
      unit_type: formData.unit_type,
      aliases: formData.aliases.trim() || null,
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/stock/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated = await res.json();
        setStock((prev) => prev.map((s) => (s.id === editingItem.id ? updated : s)));
        showToast("Stock updated");
      } else {
        const res = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        setStock((prev) => [...prev, created]);
        showToast("Stock added");
      }
      setShowModal(false);
    } catch (err) {
      showToast("Failed to save", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this item?")) return;
    try {
      await fetch(`/api/stock/${id}`, { method: "DELETE" });
      setStock((prev) => prev.filter((s) => s.id !== id));
      showToast("Item deleted");
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  };

  const handleVolumeChange = async (item: StockItem, delta: number) => {
    const newMl = Math.max(0, Math.min(item.total_ml, item.current_ml + delta));
    try {
      const res = await fetch(`/api/stock/${item.id}/volume`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_ml: newMl }),
      });
      const updated = await res.json();
      setStock((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
    } catch (err) {
      showToast("Failed to update", "error");
    }
  };

  const handleRefill = async (item: StockItem) => {
    try {
      const res = await fetch(`/api/stock/${item.id}/volume`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_ml: item.total_ml }),
      });
      const updated = await res.json();
      setStock((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
      showToast(`${item.name} refilled!`);
    } catch (err) {
      showToast("Failed to refill", "error");
    }
  };

  const handleAddToShopping = async (item: StockItem) => {
    try {
      await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient_name: item.name, stock_id: item.id }),
      });
      setShoppingList((prev) => [...prev, { stock_id: item.id, ingredient_name: item.name }]);
      showToast(`${item.name} added to shopping list`);
    } catch (err) {
      showToast("Failed to add to shopping list", "error");
    }
  };

  // Check if item is in shopping list
  const isInShoppingList = (item: StockItem) => {
    return shoppingList.some((s) => s.stock_id === item.id || s.ingredient_name.toLowerCase() === item.name.toLowerCase());
  };

  // Quick edit - tap percentage to enter a value like "50%" or "350ml"
  const handleQuickEdit = (item: StockItem) => {
    setQuickEditId(item.id);
    if (item.unit_type === "count") {
      setQuickEditValue(`${item.current_ml}`);
    } else {
      setQuickEditValue(`${Math.round((item.current_ml / item.total_ml) * 100)}%`);
    }
  };

  const handleQuickEditSave = async (item: StockItem) => {
    let newMl: number | null;

    if (item.unit_type === "count") {
      newMl = parseInt(quickEditValue);
      if (isNaN(newMl) || newMl < 0) {
        showToast("Invalid count", "error");
        return;
      }
    } else {
      newMl = parseVolume(quickEditValue, item.total_ml);
      if (newMl === null || newMl < 0) {
        showToast("Invalid amount (try 50%, 350ml, 12oz)", "error");
        return;
      }
    }

    try {
      const res = await fetch(`/api/stock/${item.id}/volume`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_ml: Math.min(newMl, item.total_ml) }),
      });
      const updated = await res.json();
      setStock((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
      showToast("Updated!");
    } catch (err) {
      showToast("Failed to update", "error");
    }
    setQuickEditId(null);
  };

  const searchLower = searchQuery.toLowerCase();

  // Sort function
  const sortStock = (items: StockItem[]) => {
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "empty":
          return (a.current_ml / a.total_ml) - (b.current_ml / b.total_ml);
        case "full":
          return (b.current_ml / b.total_ml) - (a.current_ml / a.total_ml);
        case "size-big":
          return b.total_ml - a.total_ml;
        case "size-small":
          return a.total_ml - b.total_ml;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  };

  const filteredStock = sortStock(stock.filter((s) => {
    const matchesCategory = filter === "All" || s.category === filter;
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  }));
  const categories = ["All", ...CATEGORIES];

  // Calculate category counts
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = cat === "All" ? stock.length : stock.filter((s) => s.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  // Render a compact stock item
  const renderStockItem = (item: StockItem) => {
    const inShoppingList = isInShoppingList(item);
    const percent = Math.round((item.current_ml / item.total_ml) * 100);
    const isExpanded = expandedStockId === item.id;
    const drinks = stockDrinks[item.id] || [];
    const drinkCount = drinkCounts[item.id];

    return (
    <div key={item.id} className={`stock-row-container ${isExpanded ? "expanded" : ""}`}>
      <div className={`stock-row ${!isOwner ? "stock-row-guest" : ""}`}>
        <div className="stock-row-main">
          <Bottle currentMl={item.current_ml} totalMl={item.total_ml} size="xs" />
          <div className="stock-row-info">
            <span className="stock-row-name">
              {item.name}
              <span className="badge" style={{ marginLeft: "0.5rem", fontSize: "0.625rem", padding: "0.125rem 0.375rem" }}>{item.category}</span>
              {isOwner && inShoppingList && <span style={{ marginLeft: "0.5rem", color: "var(--warning)" }}>🛒</span>}
            </span>
            <span className="stock-row-volume">
              {item.unit_type === "count"
                ? `${item.current_ml}/${item.total_ml}`
                : `${formatVolume(item.current_ml)}/${formatVolume(item.total_ml)}`}
            </span>
          </div>
          {isOwner ? (
            quickEditId === item.id ? (
              <input
                className="input stock-row-quick-input"
                value={quickEditValue}
                onChange={(e) => setQuickEditValue(e.target.value)}
                onBlur={() => handleQuickEditSave(item)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickEditSave(item)}
                autoFocus
                placeholder={item.unit_type === "count" ? "5" : "50%"}
              />
            ) : (
              <div
                className="stock-row-percent"
                onClick={() => handleQuickEdit(item)}
                title={item.unit_type === "count" ? "Tap to edit" : "Tap to edit (50%, 350ml)"}
              >
                {item.unit_type === "count"
                  ? item.current_ml
                  : `${percent}%`}
              </div>
            )
          ) : (
            <div className="stock-row-percent" style={{ cursor: "default" }}>
              {item.unit_type === "count" ? item.current_ml : `${percent}%`}
            </div>
          )}
        </div>
        <div className="stock-row-drinks-toggle" onClick={() => toggleExpanded(item.id)}>
          <span className="drinks-count">
            {drinkCount !== undefined ? `${drinkCount} drink${drinkCount !== 1 ? "s" : ""}` : "View drinks"}
          </span>
          <span className={`expand-arrow ${isExpanded ? "expanded" : ""}`}>▼</span>
        </div>
        {isOwner && (
          <div className="stock-row-controls">
            <button className="volume-btn-sm" onClick={() => handleVolumeChange(item, item.unit_type === "count" ? -1 : -30)}>−</button>
            <button className="volume-btn-sm" onClick={() => handleVolumeChange(item, item.unit_type === "count" ? 1 : 30)}>+</button>
            <button
              className={`btn btn-xs ${inShoppingList ? "btn-success" : "btn-secondary"}`}
              onClick={() => !inShoppingList && handleAddToShopping(item)}
              disabled={inShoppingList}
              title={inShoppingList ? "Already in shopping list" : "Add to shopping list"}
            >
              🛒
            </button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleRefill(item)}>Refill</button>
            <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(item)}>Edit</button>
            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(item.id)}>✕</button>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="stock-drinks-list">
          {drinks.length === 0 ? (
            <div className="stock-drinks-empty">No drinks use this ingredient</div>
          ) : (
            drinks.map((drink) => (
              <div
                key={drink.drink_id}
                className={`stock-drink-item ${drink.on_menu ? "on-menu" : ""}`}
                onClick={() => navigate(`/drinks?id=${drink.drink_id}`)}
              >
                <span className="drink-name">{drink.drink_name}</span>
                <span className="drink-category">{drink.drink_category}</span>
                {drink.on_menu ? <span className="on-menu-badge">On Menu</span> : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <h1>{isOwner ? "Stock" : "Shelf"}</h1>
        {isOwner && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/shopping")}>
              🛒 Shop {shoppingList.length > 0 && `(${shoppingList.length})`}
            </button>
            <button className="btn btn-primary" onClick={handleAdd}>
              + Add
            </button>
          </div>
        )}
      </div>

      <div className="tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`tab ${filter === cat ? "active" : ""}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
            {categoryCounts[cat] > 0 && (
              <span className="tab-count">{categoryCounts[cat]}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          className="input"
          type="text"
          placeholder="Search stock..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <select
          className="select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={{ width: "auto", padding: "0.5rem 2rem 0.5rem 0.75rem" }}
        >
          <option value="name">A-Z</option>
          <option value="empty">Empty first</option>
          <option value="full">Full first</option>
          <option value="size-big">Biggest</option>
          <option value="size-small">Smallest</option>
        </select>
      </div>

      {filteredStock.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍾</div>
          {stock.length === 0 ? (
            <>
              <p>{isOwner ? "No stock items yet" : "The shelf is empty"}</p>
              {isOwner && (
                <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: "1rem" }}>
                  Add your first bottle
                </button>
              )}
            </>
          ) : (
            <p>No items match your search</p>
          )}
        </div>
      ) : (
        <div className="stock-list">
          {filteredStock.map((item) => renderStockItem(item))}
        </div>
      )}

      {/* Unavailable Drinks Section */}
      {unavailableDrinks.length > 0 && (
        <div className="unavailable-drinks-section">
          <div
            className="unavailable-drinks-header"
            onClick={() => setShowUnavailable(!showUnavailable)}
          >
            <h3>
              Can't Make Yet
              <span className="unavailable-count">{unavailableDrinks.length}</span>
            </h3>
            <span className={`expand-arrow ${showUnavailable ? "expanded" : ""}`}>▼</span>
          </div>
          {showUnavailable && (
            <div className="unavailable-drinks-list">
              {unavailableDrinks.map((drink) => (
                <div
                  key={drink.id}
                  className="unavailable-drink-item"
                  onClick={() => setSelectedDrink(drink)}
                >
                  <div className="unavailable-drink-info">
                    <span className="drink-name">{drink.name}</span>
                    <span className="drink-category">{drink.category}</span>
                  </div>
                  <div className="missing-ingredients">
                    Missing: {drink.missingIngredients.slice(0, 3).join(", ")}
                    {drink.missingIngredients.length > 3 && ` +${drink.missingIngredients.length - 3} more`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drink Detail Modal */}
      {selectedDrink && (
        <div className="modal-overlay" onMouseDown={() => setSelectedDrink(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{selectedDrink.name}</h2>
            <p className="drink-category-label">{selectedDrink.category}</p>

            {selectedDrink.description && (
              <p className="drink-description">{selectedDrink.description}</p>
            )}

            <div className="form-group">
              <label className="label">Ingredients</label>
              <div className="ingredient-list">
                {selectedDrink.ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className={`ingredient-item ${!ing.stock_id ? "missing" : ""} ${ing.optional ? "optional" : ""}`}
                  >
                    <span className="ingredient-name">
                      {ing.name}
                      {ing.optional && <span className="optional-badge">optional</span>}
                    </span>
                    {ing.amount && <span className="ingredient-amount">{ing.amount}</span>}
                    {!ing.stock_id && !ing.optional && <span className="missing-badge">Not in stock</span>}
                  </div>
                ))}
              </div>
            </div>

            {selectedDrink.instructions && (
              <div className="form-group">
                <label className="label">Instructions</label>
                <p className="instructions-text">{selectedDrink.instructions}</p>
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
                onClick={() => {
                  setSelectedDrink(null);
                  navigate(`/drinks?id=${selectedDrink.id}`);
                }}
              >
                View in Drinks
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onMouseDown={() => setShowModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{editingItem ? "Edit Stock" : "Add Stock"}</h2>

            <div className="form-group">
              <label className="label">Name</label>
              <input
                className="input"
                list="ingredient-suggestions"
                placeholder="e.g. Absolut Vodka"
                value={formData.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  const suggestedCat = suggestCategory(newName);
                  setFormData({
                    ...formData,
                    name: newName,
                    // Auto-fill category only if not editing and we have a suggestion
                    ...(suggestedCat && !editingItem ? { category: suggestedCat } : {}),
                  });
                }}
              />
              <datalist id="ingredient-suggestions">
                {ingredientSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label className="label">Category</label>
              <select
                className="select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Type</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={`btn ${formData.unit_type === "ml" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                  onClick={() => setFormData({ ...formData, unit_type: "ml", total_input: "700ml", current_input: "700ml" })}
                >
                  Liquid (ml)
                </button>
                <button
                  type="button"
                  className={`btn ${formData.unit_type === "count" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                  onClick={() => setFormData({ ...formData, unit_type: "count", total_input: "10", current_input: "10" })}
                >
                  Count
                </button>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                Use Count for items like eggs, limes, cherries, etc.
              </div>
            </div>

            <div className="form-group">
              <label className="label">{formData.unit_type === "count" ? "Total Count" : "Bottle Size"}</label>
              <input
                className="input"
                placeholder={formData.unit_type === "count" ? "e.g. 12" : "700ml, 70cl, 25oz"}
                value={formData.total_input}
                onChange={(e) => setFormData({ ...formData, total_input: e.target.value })}
              />
              {formData.unit_type === "ml" && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Accepts: 700ml, 70cl, 25oz, or just 700
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="label">{formData.unit_type === "count" ? "Current Count" : "Current Amount"}</label>
              <input
                className="input"
                placeholder={formData.unit_type === "count" ? "e.g. 8" : "50%, 350ml, 12oz"}
                value={formData.current_input}
                onChange={(e) => setFormData({ ...formData, current_input: e.target.value })}
              />
              {formData.unit_type === "ml" && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Accepts: 50% (of bottle), 350ml, 35cl, or 12oz
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="label">Aliases (optional)</label>
              <input
                className="input"
                placeholder="e.g. Smirnoff, Grey Goose, Absolut"
                value={formData.aliases}
                onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                Comma-separated brand names or alternative names for auto-matching
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
