import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatVolume } from "../utils/volume";

interface MenuIngredient {
  name: string;
  amount: string | null;
  optional: boolean;
}

interface MenuDrink {
  id: number;
  name: string;
  category: string;
  instructions: string | null;
  description: string | null;
  image_path: string | null;
  times_made: number;
  menu_drink_id: number;
  menu_hidden: number;
  canMake: boolean;
  servingsLeft: number;
  ingredients: MenuIngredient[];
}

interface Menu {
  id: number;
  name: string;
  description: string | null;
  active: number;
  drinks: MenuDrink[];
}

export function Menu() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrink, setSelectedDrink] = useState<MenuDrink | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [requestName, setRequestName] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [filterType, setFilterType] = useState<"all" | "menu" | "category">("all");
  const [filterValue, setFilterValue] = useState<string>("all");
  const { logout, session } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isOwner = session?.type === "owner";

  useEffect(() => {
    fetchData();
    // Poll queue status every 10 seconds
    const interval = setInterval(fetchQueueStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [menusRes, statusRes] = await Promise.all([
        fetch("/api/menus"),
        fetch("/api/queue/status"),
      ]);
      const menusData = await menusRes.json();
      const statusData = await statusRes.json();
      setMenus(menusData);
      setBarOpen(statusData.barOpen);
      setPendingCount(statusData.pendingCount);
    } catch (err) {
      showToast("Failed to load menu", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch("/api/queue/status");
      const data = await res.json();
      setBarOpen(data.barOpen);
      setPendingCount(data.pendingCount);
    } catch {}
  };

  const handleRequestDrink = async () => {
    if (!selectedDrink || !requestName.trim()) {
      showToast("Please enter your name", "error");
      return;
    }

    try {
      const res = await fetch("/api/queue/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drinkId: selectedDrink.id,
          guestName: requestName.trim(),
        }),
      });

      if (res.ok) {
        showToast(`Requested ${selectedDrink.name}!`);
        setShowRequestModal(false);
        setSelectedDrink(null);
        setRequestName("");
        fetchQueueStatus();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to request drink", "error");
      }
    } catch (err) {
      showToast("Failed to request drink", "error");
    }
  };

  // Filter drinks based on role
  const getVisibleDrinks = (drinks: MenuDrink[]) => {
    if (isOwner) return drinks;
    // Guests only see: canMake = true AND menu_hidden = 0
    return drinks.filter((d) => d.canMake && d.menu_hidden === 0);
  };

  // Get all visible drinks across all menus (deduped by drink id)
  const allVisibleDrinks = (() => {
    const seen = new Set<number>();
    const drinks: MenuDrink[] = [];
    for (const menu of menus.filter(m => isOwner || m.active === 1)) {
      for (const drink of getVisibleDrinks(menu.drinks)) {
        if (!seen.has(drink.id)) {
          seen.add(drink.id);
          drinks.push(drink);
        }
      }
    }
    return drinks;
  })();

  // Get unique categories from visible drinks
  const categories = [...new Set(allVisibleDrinks.map(d => d.category))].sort();

  // Get visible menu names
  const menuNames = menus.filter(m => isOwner || m.active === 1).map(m => m.name);

  // Filter drinks based on current filter
  const filteredDrinks = filterValue === "all"
    ? allVisibleDrinks
    : filterType === "menu"
      ? allVisibleDrinks.filter(d => {
          const menu = menus.find(m => m.name === filterValue);
          return menu?.drinks.some(md => md.id === d.id);
        })
      : allVisibleDrinks.filter(d => d.category === filterValue);

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  // Count visible menus
  const visibleMenus = menus.filter((m) => isOwner || m.active === 1);

  return (
    <div className="page">
      <div className="header">
        <h1>Menu</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {pendingCount > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/queue")}
            >
              Queue ({pendingCount})
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </div>


      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button
          className={`tab ${filterValue === "all" ? "active" : ""}`}
          onClick={() => { setFilterType("all"); setFilterValue("all"); }}
        >
          All
          <span className="tab-count">{allVisibleDrinks.length}</span>
        </button>
        {menuNames.map(name => (
          <button
            key={name}
            className={`tab ${filterType === "menu" && filterValue === name ? "active" : ""}`}
            onClick={() => { setFilterType("menu"); setFilterValue(name); }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Category filter (secondary) */}
      {categories.length > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${filterType === "category" && filterValue === cat ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                if (filterType === "category" && filterValue === cat) {
                  setFilterType("all");
                  setFilterValue("all");
                } else {
                  setFilterType("category");
                  setFilterValue(cat);
                }
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {allVisibleDrinks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No drinks available</p>
          {isOwner && (
            <button
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
              onClick={() => navigate("/menus")}
            >
              Create a Menu
            </button>
          )}
        </div>
      ) : filteredDrinks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No drinks match this filter</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {filteredDrinks.map((drink) => {
            const isGhosted = isOwner && (!drink.canMake || drink.menu_hidden === 1);
            const showLowWarning = drink.canMake && drink.servingsLeft <= 3;

            return (
              <div
                key={drink.id}
                className="card"
                onClick={() => {
                  setSelectedDrink(drink);
                  // Find which menu this drink belongs to
                  const menu = menus.find(m => m.drinks.some(d => d.id === drink.id));
                  setSelectedMenu(menu || null);
                }}
                style={{
                  cursor: "pointer",
                  opacity: isGhosted ? 0.5 : 1,
                  position: "relative",
                }}
              >
                {isOwner && drink.menu_hidden === 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "0.5rem",
                      right: "0.5rem",
                      fontSize: "1rem",
                    }}
                  >
                    👁️‍🗨️
                  </div>
                )}
                {drink.image_path && (
                  <img
                    src={drink.image_path}
                    alt={drink.name}
                    className="drink-image"
                    style={{
                      marginBottom: "0.75rem",
                      filter: isGhosted ? "grayscale(70%)" : "none",
                    }}
                  />
                )}
                <div style={{ fontWeight: 600 }}>{drink.name}</div>
                <div className="badge" style={{ marginTop: "0.25rem" }}>{drink.category}</div>
                {drink.description && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.8125rem", fontStyle: "italic", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {drink.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {drink.canMake ? (
                    showLowWarning ? (
                      <span className="badge badge-warning">
                        {drink.servingsLeft === 1 ? "Last one!" : `Only ${drink.servingsLeft} left!`}
                      </span>
                    ) : (
                      <span className="badge badge-success">Available</span>
                    )
                  ) : (
                    <span className="badge badge-danger">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drink Detail Modal */}
      {selectedDrink && !showRequestModal && (
        <div className="modal-overlay" onMouseDown={() => setSelectedDrink(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            {selectedDrink.image_path && (
              <img
                src={selectedDrink.image_path}
                alt={selectedDrink.name}
                className="drink-image"
                style={{ marginBottom: "1rem" }}
              />
            )}
            <h2 className="modal-title">{selectedDrink.name}</h2>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <div className="badge">{selectedDrink.category}</div>
              {selectedDrink.canMake && selectedDrink.servingsLeft <= 3 && (
                <div className="badge badge-warning">
                  {selectedDrink.servingsLeft === 1 ? "Last one!" : `Only ${selectedDrink.servingsLeft} left!`}
                </div>
              )}
              {selectedDrink.times_made > 0 && (
                <div className="badge badge-success">Made {selectedDrink.times_made}x</div>
              )}
            </div>

            {selectedDrink.ingredients && selectedDrink.ingredients.length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                  INGREDIENTS
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {selectedDrink.ingredients.map((ing, idx) => (
                    <li key={idx} style={{
                      padding: "0.375rem 0",
                      borderBottom: idx < selectedDrink.ingredients.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      opacity: ing.optional ? 0.7 : 1,
                    }}>
                      <span>{ing.name}{ing.optional && " (optional)"}</span>
                      {ing.amount && <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{ing.amount}</span>}
                    </li>
                  ))}
                </ul>
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

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: "1 1 45%" }}
                onClick={() => setSelectedDrink(null)}
              >
                Close
              </button>
              {selectedDrink.canMake && barOpen ? (
                <button
                  className="btn btn-primary"
                  style={{ flex: "1 1 45%" }}
                  onClick={() => setShowRequestModal(true)}
                >
                  Request
                </button>
              ) : !barOpen ? (
                <div
                  style={{
                    flex: "1 1 45%",
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid var(--danger)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem",
                    textAlign: "center",
                    fontSize: "0.875rem",
                  }}
                >
                  Bar is closed
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Request Name Modal */}
      {showRequestModal && selectedDrink && (
        <div className="modal-overlay" onMouseDown={() => setShowRequestModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Request {selectedDrink.name}</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Enter your name so we know who to call when it's ready!
            </p>

            <div className="form-group">
              <label className="label">Your Name</label>
              <input
                className="input"
                placeholder="e.g. Sarah"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRequestDrink()}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowRequestModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleRequestDrink}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
