import React, { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";

interface MenuDrink {
  id: number;
  name: string;
  category: string;
  image_path: string | null;
  canMake: boolean;
  servingsLeft: number;
}

interface Menu {
  id: number;
  name: string;
  description: string | null;
  active: number;
  drinks: MenuDrink[];
}

export function Kiosk() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrink, setSelectedDrink] = useState<MenuDrink | null>(null);
  const [requestName, setRequestName] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
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
      // Silently fail for auto-refresh
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDrink = async () => {
    if (!selectedDrink || !requestName.trim()) {
      showToast("Please enter your name", "error");
      return;
    }

    setSubmitting(true);
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
        showToast(`${selectedDrink.name} requested! We'll call ${requestName.trim()} when it's ready.`);
        setShowRequestModal(false);
        setSelectedDrink(null);
        setRequestName("");
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to request drink", "error");
      }
    } catch (err) {
      showToast("Failed to request drink", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Get all available drinks from active menus
  const getAllAvailableDrinks = () => {
    const drinks: MenuDrink[] = [];
    for (const menu of menus) {
      if (menu.active !== 1) continue;
      for (const drink of menu.drinks) {
        if (drink.canMake && !drinks.find((d) => d.id === drink.id)) {
          drinks.push(drink);
        }
      }
    }
    return drinks;
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <div className="spinner" style={{ width: "3rem", height: "3rem" }} />
      </div>
    );
  }

  const availableDrinks = getAllAvailableDrinks();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        padding: "2rem",
        paddingBottom: "6rem",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0 }}>Order a Drink</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "1.25rem" }}>
          Tap a drink to request it
        </p>
      </div>

      {/* Bar closed overlay */}
      {!barOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🍸</div>
            <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Bar is Closed</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.25rem" }}>
              Check back soon!
            </p>
          </div>
        </div>
      )}

      {/* Drinks grid */}
      {availableDrinks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🍹</div>
          <p style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
            No drinks available right now
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1.5rem",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          {availableDrinks.map((drink) => {
            const showLowWarning = drink.servingsLeft <= 3;

            return (
              <div
                key={drink.id}
                onClick={() => {
                  setSelectedDrink(drink);
                  setShowRequestModal(true);
                }}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: "1rem",
                  padding: "1.5rem",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  textAlign: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(124, 58, 237, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {drink.image_path ? (
                  <img
                    src={drink.image_path}
                    alt={drink.name}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      borderRadius: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      background: "var(--bg-secondary)",
                      borderRadius: "0.75rem",
                      marginBottom: "1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "3rem",
                    }}
                  >
                    🍸
                  </div>
                )}
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{drink.name}</h3>
                {showLowWarning && (
                  <div
                    className="badge badge-warning"
                    style={{ marginTop: "0.75rem" }}
                  >
                    {drink.servingsLeft === 1 ? "Last one!" : `Only ${drink.servingsLeft} left!`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status bar at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--bg-secondary)",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1rem",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <span style={{ fontSize: "1.25rem" }}>🍹</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {pendingCount > 0
            ? `${pendingCount} drink${pendingCount !== 1 ? "s" : ""} being made`
            : "Tap a drink to order"}
        </span>
      </div>

      {/* Request Modal */}
      {showRequestModal && selectedDrink && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!submitting) {
              setShowRequestModal(false);
              setSelectedDrink(null);
            }
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px", padding: "2rem" }}
          >
            {selectedDrink.image_path && (
              <img
                src={selectedDrink.image_path}
                alt={selectedDrink.name}
                style={{
                  width: "150px",
                  height: "150px",
                  objectFit: "cover",
                  borderRadius: "1rem",
                  margin: "0 auto 1.5rem",
                  display: "block",
                }}
              />
            )}
            <h2 style={{ textAlign: "center", fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              {selectedDrink.name}
            </h2>
            <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              Enter your name and we'll call you when it's ready!
            </p>

            <input
              className="input"
              style={{ fontSize: "1.25rem", textAlign: "center", marginBottom: "1rem" }}
              placeholder="Your name"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRequestDrink()}
            />

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: "1.25rem" }}
                onClick={() => {
                  setShowRequestModal(false);
                  setSelectedDrink(null);
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: "1.25rem" }}
                onClick={handleRequestDrink}
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
