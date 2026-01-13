import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

interface Ingredient {
  ingredient_name: string;
  amount_ml: number | null;
  amount_text: string | null;
  stock_id: number | null;
}

interface DrinkItem {
  id: number;
  name: string;
  category: string;
  instructions: string | null;
  image_path: string | null;
  ingredients: Ingredient[];
}

interface StockItem {
  id: number;
  name: string;
  current_ml: number;
}

export function Menu() {
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selectedDrink, setSelectedDrink] = useState<DrinkItem | null>(null);
  const { logout, session } = useAuth();

  useEffect(() => {
    Promise.all([
      fetch("/api/drinks").then((r) => r.json()),
      fetch("/api/stock").then((r) => r.json()),
    ])
      .then(([drinksData, stockData]) => {
        setDrinks(drinksData);
        setStock(stockData);
      })
      .finally(() => setLoading(false));
  }, []);

  const checkAvailability = (drink: DrinkItem): boolean => {
    return drink.ingredients.every((ing) => {
      if (!ing.stock_id || !ing.amount_ml) return true; // Unlinked ingredients assumed available
      const stockItem = stock.find((s) => s.id === ing.stock_id);
      return stockItem && stockItem.current_ml >= ing.amount_ml;
    });
  };

  const categories = ["All", ...new Set(drinks.map((d) => d.category))];
  const filteredDrinks = filter === "All" ? drinks : drinks.filter((d) => d.category === filter);

  // Sort by availability
  const sortedDrinks = [...filteredDrinks].sort((a, b) => {
    const aAvail = checkAvailability(a);
    const bAvail = checkAvailability(b);
    if (aAvail && !bAvail) return -1;
    if (!aAvail && bAvail) return 1;
    return a.name.localeCompare(b.name);
  });

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
        <h1>Menu</h1>
        <button className="btn btn-secondary btn-sm" onClick={logout}>
          Logout
        </button>
      </div>

      {session?.type === "guest" && (
        <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Welcome! Browse the available drinks below.
        </p>
      )}

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

      {sortedDrinks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍹</div>
          <p>No drinks on the menu yet</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {sortedDrinks.map((drink) => {
            const available = checkAvailability(drink);
            return (
              <div
                key={drink.id}
                className="card"
                onClick={() => setSelectedDrink(drink)}
                style={{ cursor: "pointer", opacity: available ? 1 : 0.5 }}
              >
                {drink.image_path && (
                  <img
                    src={drink.image_path}
                    alt={drink.name}
                    className="drink-image"
                    style={{ marginBottom: "0.75rem" }}
                  />
                )}
                <div style={{ fontWeight: 600 }}>{drink.name}</div>
                <div className="availability" style={{ marginTop: "0.5rem" }}>
                  <span className={`availability-dot ${available ? "available" : "unavailable"}`} />
                  <span>{available ? "Available" : "Low stock"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDrink && (
        <div className="modal-overlay" onClick={() => setSelectedDrink(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {selectedDrink.image_path && (
              <img
                src={selectedDrink.image_path}
                alt={selectedDrink.name}
                className="drink-image"
                style={{ marginBottom: "1rem" }}
              />
            )}
            <h2 className="modal-title">{selectedDrink.name}</h2>
            <div className="badge">{selectedDrink.category}</div>

            {selectedDrink.ingredients.length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                  INGREDIENTS
                </h3>
                {selectedDrink.ingredients.map((ing, i) => {
                  const stockItem = ing.stock_id ? stock.find((s) => s.id === ing.stock_id) : null;
                  const hasEnough = !stockItem || !ing.amount_ml || stockItem.current_ml >= ing.amount_ml;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                        color: hasEnough ? "inherit" : "var(--danger)",
                      }}
                    >
                      <span>{ing.ingredient_name}</span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {ing.amount_text || (ing.amount_ml ? `${ing.amount_ml}ml` : "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedDrink.instructions && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                  INSTRUCTIONS
                </h3>
                <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedDrink.instructions}</p>
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "1.5rem" }}
              onClick={() => setSelectedDrink(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
