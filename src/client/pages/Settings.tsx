import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface Passcode {
  type: string;
  code: string;
}

export function Settings() {
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerCode, setOwnerCode] = useState("");
  const [guestCode, setGuestCode] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const { logout } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setPasscodes(data.passcodes);
        const owner = data.passcodes.find((p: Passcode) => p.type === "owner");
        const guest = data.passcodes.find((p: Passcode) => p.type === "guest");
        if (owner) setOwnerCode(owner.code);
        if (guest) setGuestCode(guest.code);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (type: "owner" | "guest") => {
    const code = type === "owner" ? ownerCode : guestCode;
    if (code.length < 4) {
      showToast("Passcode must be at least 4 characters", "error");
      return;
    }

    setSaving(type);
    try {
      const res = await fetch("/api/settings/passcode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, code }),
      });

      if (res.ok) {
        showToast(`${type === "owner" ? "Owner" : "Guest"} passcode updated`);
      } else {
        showToast("Failed to update", "error");
      }
    } catch (err) {
      showToast("Failed to update", "error");
    } finally {
      setSaving(null);
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
        <h1>Settings</h1>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Owner Passcode</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Full access to manage stock, drinks, and settings
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="input"
            type="text"
            value={ownerCode}
            onChange={(e) => setOwnerCode(e.target.value)}
            placeholder="Enter new passcode"
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSave("owner")}
            disabled={saving === "owner"}
          >
            {saving === "owner" ? "..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Guest Passcode</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          View-only access to see the menu
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="input"
            type="text"
            value={guestCode}
            onChange={(e) => setGuestCode(e.target.value)}
            placeholder="Enter new passcode"
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSave("guest")}
            disabled={saving === "guest"}
          >
            {saving === "guest" ? "..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>About</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          BarStock - Your personal bar inventory tracker
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          Cocktail data from TheCocktailDB
        </p>
      </div>

      <button
        className="btn btn-danger"
        style={{ width: "100%" }}
        onClick={logout}
      >
        Logout
      </button>
    </div>
  );
}
