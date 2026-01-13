import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";

// Convert oz measurements to ml for display
const formatAmount = (amountText: string | null, amountMl: number | null): string => {
  if (amountMl) return `${amountMl}ml`;
  if (!amountText) return "";

  // Convert common oz patterns to ml (1 oz ≈ 30ml)
  const ozMatch = amountText.match(/^([\d.\/\s]+)\s*oz$/i);
  if (ozMatch) {
    const ozStr = ozMatch[1].trim();
    let oz = 0;

    // Handle fractions like "1 1/2" or "1/2"
    const parts = ozStr.split(/\s+/);
    for (const part of parts) {
      if (part.includes("/")) {
        const [num, denom] = part.split("/").map(Number);
        oz += num / denom;
      } else {
        oz += parseFloat(part) || 0;
      }
    }

    if (oz > 0) {
      return `${Math.round(oz * 30)}ml`;
    }
  }

  return amountText;
};

interface Ingredient {
  id?: number;
  drink_id?: number;
  stock_id: number | null;
  ingredient_name: string;
  amount_ml: number | null;
  amount_text: string | null;
  optional: number;
}

interface DrinkItem {
  id: number;
  name: string;
  category: string;
  instructions: string | null;
  image_path: string | null;
  times_made: number;
  ingredients: Ingredient[];
}

interface StockItem {
  id: number;
  name: string;
  category: string;
  current_ml: number;
  total_ml: number;
}

const DRINK_CATEGORIES = ["Cocktail", "Shot", "Martini", "Tiki", "Highball", "Sour", "Other"];

export function Drinks() {
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDrink, setEditingDrink] = useState<DrinkItem | null>(null);
  const [filter, setFilter] = useState("All");
  const [makingDrink, setMakingDrink] = useState<number | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Cocktail",
    instructions: "",
    image_path: "",
    ingredients: [] as Ingredient[],
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/drinks").then((r) => r.json()),
      fetch("/api/stock").then((r) => r.json()),
    ])
      .then(([drinksData, stockData]) => {
        setDrinks(drinksData);
        setStock(stockData);
      })
      .catch(() => showToast("Failed to load", "error"))
      .finally(() => setLoading(false));
  }, []);

  // Check if we can make a drink (all required ingredients in stock with enough quantity)
  const canMakeDrink = (drink: DrinkItem): boolean => {
    const requiredIngredients = drink.ingredients.filter((ing) => !ing.optional);
    if (requiredIngredients.length === 0) return true;

    return requiredIngredients.every((ing) => {
      if (!ing.stock_id) return false;
      const stockItem = stock.find((s) => s.id === ing.stock_id);
      if (!stockItem) return false;
      // Check if we have enough - if amount_ml specified, check quantity, otherwise just check if > 0
      if (ing.amount_ml && ing.amount_ml > 0) {
        return stockItem.current_ml >= ing.amount_ml;
      }
      return stockItem.current_ml > 0;
    });
  };

  // Count missing ingredients for a drink
  const getMissingCount = (drink: DrinkItem): number => {
    return drink.ingredients.filter((ing) => {
      if (ing.optional) return false;
      if (!ing.stock_id) return true;
      const stockItem = stock.find((s) => s.id === ing.stock_id);
      if (!stockItem) return true;
      if (ing.amount_ml && ing.amount_ml > 0) {
        return stockItem.current_ml < ing.amount_ml;
      }
      return stockItem.current_ml <= 0;
    }).length;
  };

  const handleAdd = () => {
    setEditingDrink(null);
    setFormData({
      name: "",
      category: "Cocktail",
      instructions: "",
      image_path: "",
      ingredients: [{ stock_id: null, ingredient_name: "", amount_ml: null, amount_text: "", optional: 0 }],
    });
    setShowModal(true);
  };

  const handleEdit = (drink: DrinkItem) => {
    setEditingDrink(drink);
    setFormData({
      name: drink.name,
      category: drink.category,
      instructions: drink.instructions || "",
      image_path: drink.image_path || "",
      ingredients: drink.ingredients.length > 0
        ? drink.ingredients
        : [{ stock_id: null, ingredient_name: "", amount_ml: null, amount_text: "", optional: 0 }],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      ingredients: formData.ingredients.filter((i) => i.ingredient_name.trim()),
    };

    try {
      if (editingDrink) {
        const res = await fetch(`/api/drinks/${editingDrink.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated = await res.json();
        setDrinks((prev) => prev.map((d) => (d.id === editingDrink.id ? updated : d)));
        showToast("Drink updated");
      } else {
        const res = await fetch("/api/drinks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = await res.json();
        setDrinks((prev) => [...prev, created]);
        showToast("Drink added");
      }
      setShowModal(false);
    } catch (err) {
      showToast("Failed to save", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this drink?")) return;
    try {
      await fetch(`/api/drinks/${id}`, { method: "DELETE" });
      setDrinks((prev) => prev.filter((d) => d.id !== id));
      showToast("Drink deleted");
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  };

  const handleMakeIt = async (drink: DrinkItem) => {
    setMakingDrink(drink.id);
    try {
      const res = await fetch(`/api/drinks/${drink.id}/make`, { method: "POST" });
      const data = await res.json();
      if (data.updatedStock) {
        setStock((prev) =>
          prev.map((s) => {
            const updated = data.updatedStock.find((u: StockItem) => u.id === s.id);
            return updated || s;
          })
        );
      }
      // Update the drink's times_made in local state
      if (data.drink) {
        setDrinks((prev) =>
          prev.map((d) => (d.id === drink.id ? { ...d, times_made: data.drink.times_made } : d))
        );
      }
      showToast(`Made ${drink.name}! Enjoy! 🍸`);
    } catch (err) {
      showToast("Failed to update stock", "error");
    } finally {
      setMakingDrink(null);
    }
  };

  const handleAddToShopping = async (drink: DrinkItem) => {
    try {
      const res = await fetch(`/api/shopping/from-drink/${drink.id}`, { method: "POST" });
      const data = await res.json();

      if (data.added.length > 0) {
        showToast(`Added ${data.added.length} items to shopping list`);
      } else {
        showToast("All ingredients in stock or already in list");
      }
    } catch (err) {
      showToast("Failed to add to shopping list", "error");
    }
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { stock_id: null, ingredient_name: "", amount_ml: null, amount_text: "", optional: 0 }],
    });
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngredients = [...formData.ingredients];
    (newIngredients[index] as any)[field] = value;

    // Auto-fill name from stock if stock_id selected
    if (field === "stock_id" && value) {
      const stockItem = stock.find((s) => s.id === parseInt(value));
      if (stockItem) {
        newIngredients[index].ingredient_name = stockItem.name;
      }
    }

    setFormData({ ...formData, ingredients: newIngredients });
  };

  const removeIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };

  const filteredDrinks = filter === "All" ? drinks : drinks.filter((d) => d.category === filter);
  const categories = ["All", ...DRINK_CATEGORIES];

  // Calculate category counts
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = cat === "All" ? drinks.length : drinks.filter((d) => d.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

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
        <h1>Drinks</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={() => navigate("/browse")}>
            🔍 Find
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            + Add
          </button>
        </div>
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

      {filteredDrinks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍹</div>
          <p>No drinks yet</p>
          <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: "1rem" }}>
            Add your first drink
          </button>
        </div>
      ) : (
        <div className="grid">
          {filteredDrinks.map((drink) => (
            <div key={drink.id} className="card">
              {drink.image_path && (
                <img
                  src={drink.image_path}
                  alt={drink.name}
                  className="drink-image"
                  style={{ marginBottom: "1rem" }}
                />
              )}
              <div style={{ fontWeight: 600, fontSize: "1.125rem" }}>{drink.name}</div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <div className="badge">{drink.category}</div>
                {drink.times_made > 0 && (
                  <div className="badge badge-success">Made {drink.times_made}x</div>
                )}
                {!canMakeDrink(drink) && (
                  <div className="badge badge-danger">Missing {getMissingCount(drink)}</div>
                )}
              </div>

              {drink.ingredients.length > 0 && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  {drink.ingredients.map((ing, i) => {
                    const stockItem = ing.stock_id ? stock.find((s) => s.id === ing.stock_id) : null;
                    const hasEnough = stockItem && (
                      (ing.amount_ml && ing.amount_ml > 0) ? stockItem.current_ml >= ing.amount_ml : stockItem.current_ml > 0
                    );
                    const isMissing = !ing.optional && !hasEnough;
                    return (
                      <div key={i} style={{ color: isMissing ? "var(--danger)" : undefined }}>
                        {formatAmount(ing.amount_text, ing.amount_ml)} {ing.ingredient_name}
                        {isMissing && " ✗"}
                      </div>
                    );
                  })}
                </div>
              )}

              {canMakeDrink(drink) ? (
                <button
                  className="btn btn-success made-it-btn"
                  style={{ marginTop: "1rem" }}
                  onClick={() => handleMakeIt(drink)}
                  disabled={makingDrink === drink.id}
                >
                  {makingDrink === drink.id ? "Making..." : "🍸 Made It!"}
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: "1rem", width: "100%", fontSize: "0.875rem", padding: "0.75rem" }}
                  onClick={() => handleAddToShopping(drink)}
                >
                  🛒 Add Missing to Shop
                </button>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleEdit(drink)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(drink.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h2 className="modal-title">{editingDrink ? "Edit Drink" : "Add Drink"}</h2>

            <div className="form-group">
              <label className="label">Name</label>
              <input
                className="input"
                placeholder="e.g. Mojito"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="label">Category</label>
              <select
                className="select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {DRINK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Image URL (optional)</label>
              <input
                className="input"
                placeholder="https://..."
                value={formData.image_path}
                onChange={(e) => setFormData({ ...formData, image_path: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="label">Instructions</label>
              <textarea
                className="textarea"
                placeholder="How to make this drink..."
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="label">Ingredients</label>
              {formData.ingredients.map((ing, index) => (
                <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select
                    className="select"
                    style={{ width: "40%" }}
                    value={ing.stock_id || ""}
                    onChange={(e) => updateIngredient(index, "stock_id", e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Link to stock...</option>
                    {stock.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ width: "30%" }}
                    placeholder="Name"
                    value={ing.ingredient_name}
                    onChange={(e) => updateIngredient(index, "ingredient_name", e.target.value)}
                  />
                  <input
                    className="input"
                    style={{ width: "20%" }}
                    placeholder="30ml"
                    value={ing.amount_text || (ing.amount_ml ? `${ing.amount_ml}ml` : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      const mlMatch = val.match(/^(\d+)\s*ml?$/i);
                      if (mlMatch) {
                        updateIngredient(index, "amount_ml", parseInt(mlMatch[1]));
                        updateIngredient(index, "amount_text", "");
                      } else {
                        updateIngredient(index, "amount_ml", null);
                        updateIngredient(index, "amount_text", val);
                      }
                    }}
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: "0.5rem" }}
                    onClick={() => removeIngredient(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addIngredient}>
                + Add Ingredient
              </button>
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
