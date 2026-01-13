import React, { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { parseVolume, formatVolume } from "../utils/volume";

interface ShoppingListDrink {
  drink_id: number;
  name: string;
}

interface ShoppingListItem {
  id: number;
  ingredient_name: string;
  stock_id: number | null;
  quantity: number;
  notes: string | null;
  suggested: number;
  created_at: string;
  drinks: ShoppingListDrink[];
}

interface LowStockItem {
  id: number;
  name: string;
  category: string;
  current_ml: number;
  total_ml: number;
  percentage: number;
}

const CATEGORIES = ["Spirits", "Liqueurs", "Mixers", "Wine", "Beer", "Other"];

export function Shopping() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [suggestions, setSuggestions] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "suggestions">("list");
  const [showAddModal, setShowAddModal] = useState(false);
  const [bottleSizeItem, setBottleSizeItem] = useState<ShoppingListItem | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [bottleSize, setBottleSize] = useState("700ml");
  const [bottleCategory, setBottleCategory] = useState("Spirits");
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, suggestionsRes] = await Promise.all([
        fetch("/api/shopping"),
        fetch("/api/shopping/suggestions"),
      ]);
      const itemsData = await itemsRes.json();
      const suggestionsData = await suggestionsRes.json();
      setItems(itemsData);
      setSuggestions(suggestionsData);
    } catch (err) {
      showToast("Failed to load shopping list", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient_name: newItemName.trim() }),
      });

      if (res.status === 409) {
        showToast("Item already in list", "error");
        return;
      }

      const item = await res.json();
      setItems((prev) => [{ ...item, drinks: [] }, ...prev]);
      setNewItemName("");
      setShowAddModal(false);
      showToast("Added to shopping list");
    } catch (err) {
      showToast("Failed to add item", "error");
    }
  };

  const handleRemoveItem = async (id: number) => {
    try {
      await fetch(`/api/shopping/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast("Removed from list");
    } catch (err) {
      showToast("Failed to remove", "error");
    }
  };

  const handleBought = async (item: ShoppingListItem) => {
    try {
      const res = await fetch(`/api/shopping/${item.id}/bought`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.action === "refilled") {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        showToast(`${item.ingredient_name} refilled!`);
        // Refresh suggestions since stock changed
        const suggestionsRes = await fetch("/api/shopping/suggestions");
        setSuggestions(await suggestionsRes.json());
      } else if (data.action === "created") {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        showToast(`${item.ingredient_name} added to stock!`);
      } else if (data.action === "needs_size") {
        // Show bottle size modal
        setBottleSizeItem(item);
        setBottleSize("700ml");
        setBottleCategory("Spirits");
      }
    } catch (err) {
      showToast("Failed to mark as bought", "error");
    }
  };

  const handleBottleSizeSubmit = async () => {
    if (!bottleSizeItem) return;

    const ml = parseVolume(bottleSize);
    if (!ml || ml <= 0) {
      showToast("Invalid bottle size", "error");
      return;
    }

    try {
      const res = await fetch(`/api/shopping/${bottleSizeItem.id}/bought`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_ml: ml, category: bottleCategory }),
      });

      const data = await res.json();
      if (data.action === "created") {
        setItems((prev) => prev.filter((i) => i.id !== bottleSizeItem.id));
        showToast(`${bottleSizeItem.ingredient_name} added to stock!`);
      }
    } catch (err) {
      showToast("Failed to add to stock", "error");
    }

    setBottleSizeItem(null);
  };

  const handleAddSuggestion = async (stockId: number) => {
    try {
      const res = await fetch("/api/shopping/add-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockIds: [stockId] }),
      });

      const data = await res.json();
      if (data.added.length > 0) {
        setItems((prev) => [...data.added.map((i: ShoppingListItem) => ({ ...i, drinks: [] })), ...prev]);
        showToast("Added to shopping list");
      }
    } catch (err) {
      showToast("Failed to add", "error");
    }
  };

  const handleAddAllSuggestions = async () => {
    const stockIds = suggestions.map((s) => s.id);
    if (stockIds.length === 0) return;

    try {
      const res = await fetch("/api/shopping/add-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockIds }),
      });

      const data = await res.json();
      if (data.added.length > 0) {
        setItems((prev) => [...data.added.map((i: ShoppingListItem) => ({ ...i, drinks: [] })), ...prev]);
        showToast(`Added ${data.added.length} items to list`);
      }
    } catch (err) {
      showToast("Failed to add suggestions", "error");
    }
  };

  const handleBoughtAll = async () => {
    // Items with stock_id can be auto-refilled, others need size
    const itemsToProcess = items.map((item) => ({
      id: item.id,
      total_ml: item.stock_id ? undefined : undefined, // Will need size modal for these
    }));

    // For now, just process items that have stock_id (can be refilled)
    const refillable = items.filter((i) => i.stock_id);
    const needsSize = items.filter((i) => !i.stock_id);

    if (refillable.length > 0) {
      try {
        const res = await fetch("/api/shopping/bought-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: refillable.map((i) => ({ id: i.id })),
          }),
        });

        const data = await res.json();
        const refilledCount = data.results.filter((r: any) => r.action === "refilled").length;

        if (refilledCount > 0) {
          setItems((prev) => prev.filter((i) => !refillable.find((r) => r.id === i.id)));
          showToast(`Refilled ${refilledCount} items!`);
          // Refresh suggestions
          const suggestionsRes = await fetch("/api/shopping/suggestions");
          setSuggestions(await suggestionsRes.json());
        }
      } catch (err) {
        showToast("Failed to process items", "error");
      }
    }

    if (needsSize.length > 0) {
      showToast(`${needsSize.length} items need bottle sizes - tap each to add`);
    }
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
        <h1>Shopping</h1>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          List ({items.length})
        </button>
        <button
          className={`tab ${activeTab === "suggestions" ? "active" : ""}`}
          onClick={() => setActiveTab("suggestions")}
        >
          Low Stock ({suggestions.length})
        </button>
      </div>

      {activeTab === "list" ? (
        <>
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛒</div>
              <p>Shopping list is empty</p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                Add items from drinks or check low stock suggestions
              </p>
            </div>
          ) : (
            <>
              <div className="grid">
                {items.map((item) => (
                  <div key={item.id} className="card">
                    <div className="shopping-item">
                      <div className="shopping-item-info">
                        <div className="shopping-item-name">{item.ingredient_name}</div>
                        {item.drinks.length > 0 && (
                          <div className="shopping-item-drinks">
                            For: {item.drinks.map((d) => d.name).join(", ")}
                          </div>
                        )}
                        {item.suggested === 1 && (
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "0.75rem",
                              padding: "0.125rem 0.5rem",
                              background: "rgba(234, 179, 8, 0.2)",
                              color: "var(--warning)",
                              borderRadius: "9999px",
                              marginTop: "0.25rem",
                            }}
                          >
                            Low Stock
                          </span>
                        )}
                        {item.stock_id && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                            Will refill existing bottle
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => handleBought(item)}
                      >
                        Bought
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {items.length > 0 && (
                <div
                  style={{
                    position: "fixed",
                    bottom: "calc(5rem + env(safe-area-inset-bottom))",
                    left: 0,
                    right: 0,
                    padding: "1rem",
                    background: "var(--bg-secondary)",
                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <button className="btn btn-primary" onClick={handleBoughtAll}>
                    Bought All Refillable
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {suggestions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✓</div>
              <p>All stock is above 25%</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <button className="btn btn-secondary" onClick={handleAddAllSuggestions}>
                  Add All to List
                </button>
              </div>
              <div className="grid">
                {suggestions.map((stock) => {
                  const alreadyInList = items.some((i) => i.stock_id === stock.id);
                  return (
                    <div key={stock.id} className="card">
                      <div className="shopping-item">
                        <div
                          style={{
                            width: "3rem",
                            height: "3rem",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            fontSize: "0.875rem",
                            background:
                              stock.percentage <= 10
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(234, 179, 8, 0.2)",
                            color: stock.percentage <= 10 ? "var(--danger)" : "var(--warning)",
                            flexShrink: 0,
                          }}
                        >
                          {Math.round(stock.percentage)}%
                        </div>
                        <div className="shopping-item-info">
                          <div className="shopping-item-name">{stock.name}</div>
                          <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {formatVolume(stock.current_ml)} / {formatVolume(stock.total_ml)}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {stock.category}
                          </div>
                        </div>
                      </div>
                      <button
                        className={`btn ${alreadyInList ? "btn-secondary" : "btn-primary"}`}
                        style={{ marginTop: "1rem", width: "100%" }}
                        onClick={() => handleAddSuggestion(stock.id)}
                        disabled={alreadyInList}
                      >
                        {alreadyInList ? "In List" : "+ Add to List"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add to Shopping List</h2>
            <div className="form-group">
              <label className="label">Item Name</label>
              <input
                className="input"
                placeholder="e.g. Vodka"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddItem}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottle Size Modal */}
      {bottleSizeItem && (
        <div className="modal-overlay" onClick={() => setBottleSizeItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add to Stock</h2>
            <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
              Adding: <strong>{bottleSizeItem.ingredient_name}</strong>
            </p>

            <div className="form-group">
              <label className="label">Bottle Size</label>
              <input
                className="input"
                placeholder="700ml, 70cl, 25oz"
                value={bottleSize}
                onChange={(e) => setBottleSize(e.target.value)}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                Accepts: 700ml, 70cl, 25oz
              </div>
            </div>

            <div className="form-group">
              <label className="label">Category</label>
              <select
                className="select"
                value={bottleCategory}
                onChange={(e) => setBottleCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setBottleSizeItem(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleBottleSizeSubmit}
              >
                Add to Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
