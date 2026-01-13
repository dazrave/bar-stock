import React, { useState, useEffect } from "react";
import { Bottle } from "../components/Bottle";
import { useToast } from "../context/ToastContext";

interface StockItem {
  id: number;
  name: string;
  category: string;
  current_ml: number;
  total_ml: number;
  image_path: string | null;
}

const CATEGORIES = ["Spirits", "Liqueurs", "Mixers", "Wine", "Beer", "Other"];

export function Stock() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [filter, setFilter] = useState("All");
  const { showToast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Spirits",
    current_ml: 0,
    total_ml: 700,
  });

  useEffect(() => {
    fetchStock();
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
    setFormData({ name: "", category: "Spirits", current_ml: 0, total_ml: 700 });
    setShowModal(true);
  };

  const handleEdit = (item: StockItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      current_ml: item.current_ml,
      total_ml: item.total_ml,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        const res = await fetch(`/api/stock/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const updated = await res.json();
        setStock((prev) => prev.map((s) => (s.id === editingItem.id ? updated : s)));
        showToast("Stock updated");
      } else {
        const res = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
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

  const filteredStock = filter === "All" ? stock : stock.filter((s) => s.category === filter);
  const categories = ["All", ...CATEGORIES];

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
                  <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {item.current_ml}ml / {item.total_ml}ml
                  </div>
                </div>
              </div>

              <div className="volume-controls" style={{ marginTop: "1rem" }}>
                <button className="volume-btn" onClick={() => handleVolumeChange(item, -30)}>
                  −
                </button>
                <div className="volume-display">
                  {Math.round((item.current_ml / item.total_ml) * 100)}%
                </div>
                <button className="volume-btn" onClick={() => handleVolumeChange(item, 30)}>
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
                placeholder="e.g. Absolut Vodka"
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
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Bottle Size (ml)</label>
              <input
                className="input"
                type="number"
                placeholder="700"
                value={formData.total_ml}
                onChange={(e) => setFormData({ ...formData, total_ml: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="label">Current Amount (ml)</label>
              <input
                className="input"
                type="number"
                placeholder="700"
                value={formData.current_ml}
                onChange={(e) => setFormData({ ...formData, current_ml: parseInt(e.target.value) || 0 })}
              />
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
