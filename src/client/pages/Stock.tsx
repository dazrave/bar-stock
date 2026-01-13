import React, { useState, useEffect } from "react";
import { Bottle } from "../components/Bottle";
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
}

const CATEGORIES = STOCK_CATEGORIES;

export function Stock() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [filter, setFilter] = useState("All");
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditValue, setQuickEditValue] = useState("");
  const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>([]);
  const { showToast } = useToast();

  // Form state - using strings to allow flexible input
  const [formData, setFormData] = useState({
    name: "",
    category: "Spirits",
    total_input: "700ml",
    current_input: "700ml",
    unit_type: "ml" as "ml" | "count",
  });

  useEffect(() => {
    fetchStock();
    // Fetch ingredient suggestions for autocomplete
    fetch("/api/cocktaildb/ingredients")
      .then((r) => r.json())
      .then(setIngredientSuggestions)
      .catch(() => {}); // Silently fail - autocomplete is optional
  }, []);

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
    setFormData({ name: "", category: "Spirits", total_input: "700ml", current_input: "700ml", unit_type: "ml" });
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

  const filteredStock = filter === "All" ? stock : stock.filter((s) => s.category === filter);
  const categories = ["All", ...CATEGORIES];

  // Calculate category counts
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = cat === "All" ? stock.length : stock.filter((s) => s.category === cat).length;
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
        <h1>Stock</h1>
        <button className="btn btn-primary" onClick={handleAdd}>
          + Add
        </button>
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

      {filteredStock.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍾</div>
          <p>No stock items yet</p>
          <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: "1rem" }}>
            Add your first bottle
          </button>
        </div>
      ) : (
        <div className="grid">
          {filteredStock.map((item) => (
            <div key={item.id} className="card">
              <div className="stock-item">
                <Bottle currentMl={item.current_ml} totalMl={item.total_ml} size="sm" />
                <div className="stock-info">
                  <div className="stock-name">{item.name}</div>
                  <div className="stock-category">{item.category}</div>
                  <div style={{ fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--text-secondary)" }}>
                    {item.unit_type === "count"
                      ? `${item.current_ml} / ${item.total_ml} remaining`
                      : `${formatVolume(item.current_ml)} / ${formatVolume(item.total_ml)}`}
                  </div>
                  {item.total_used_ml > 0 && (
                    <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", color: "var(--success)" }}>
                      Used: {item.unit_type === "count" ? item.total_used_ml : formatVolume(item.total_used_ml)} all time
                    </div>
                  )}
                </div>
              </div>

              <div className="volume-controls" style={{ marginTop: "1rem" }}>
                <button className="volume-btn" onClick={() => handleVolumeChange(item, item.unit_type === "count" ? -1 : -30)}>
                  −
                </button>
                {quickEditId === item.id ? (
                  <input
                    className="input"
                    style={{ width: "5rem", textAlign: "center", padding: "0.5rem" }}
                    value={quickEditValue}
                    onChange={(e) => setQuickEditValue(e.target.value)}
                    onBlur={() => handleQuickEditSave(item)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickEditSave(item)}
                    autoFocus
                    placeholder={item.unit_type === "count" ? "5" : "50%"}
                  />
                ) : (
                  <div
                    className="volume-display"
                    onClick={() => handleQuickEdit(item)}
                    style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                    title={item.unit_type === "count" ? "Tap to edit count" : "Tap to edit (50%, 350ml, 35cl)"}
                  >
                    {item.unit_type === "count"
                      ? item.current_ml
                      : `${Math.round((item.current_ml / item.total_ml) * 100)}%`}
                  </div>
                )}
                <button className="volume-btn" onClick={() => handleVolumeChange(item, item.unit_type === "count" ? 1 : 30)}>
                  +
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => handleRefill(item)}
                >
                  Refill
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleEdit(item)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(item.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
