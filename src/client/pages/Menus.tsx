import React, { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";

interface DrinkItem {
  id: number;
  name: string;
  category: string;
  image_path: string | null;
}

interface MenuDrink {
  id: number;
  name: string;
  category: string;
  image_path: string | null;
  menu_drink_id: number;
  menu_hidden: number;
  canMake: boolean;
  servingsLeft: number;
}

interface Menu {
  id: number;
  name: string;
  description: string | null;
  active: number;
  sort_order: number;
  drinks: MenuDrink[];
}

export function Menus() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [showAddDrinksModal, setShowAddDrinksModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const { showToast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [menusRes, drinksRes] = await Promise.all([
        fetch("/api/menus"),
        fetch("/api/drinks"),
      ]);
      const menusData = await menusRes.json();
      const drinksData = await drinksRes.json();
      setMenus(menusData);
      setDrinks(drinksData);
    } catch (err) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMenu(null);
    setFormData({ name: "", description: "" });
    setShowModal(true);
  };

  const handleEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      description: menu.description || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Please enter a menu name", "error");
      return;
    }

    try {
      if (editingMenu) {
        const res = await fetch(`/api/menus/${editingMenu.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            active: editingMenu.active,
            sort_order: editingMenu.sort_order,
          }),
        });
        const updated = await res.json();
        setMenus((prev) => prev.map((m) => (m.id === editingMenu.id ? { ...m, ...updated } : m)));
        showToast("Menu updated");
      } else {
        const res = await fetch("/api/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
          }),
        });
        const created = await res.json();
        setMenus((prev) => [...prev, { ...created, drinks: [] }]);
        showToast("Menu created");
      }
      setShowModal(false);
    } catch (err) {
      showToast("Failed to save menu", "error");
    }
  };

  const handleDelete = async (menu: Menu) => {
    if (!confirm(`Delete "${menu.name}"? This will remove all drinks from this menu.`)) return;

    try {
      await fetch(`/api/menus/${menu.id}`, { method: "DELETE" });
      setMenus((prev) => prev.filter((m) => m.id !== menu.id));
      showToast("Menu deleted");
    } catch (err) {
      showToast("Failed to delete menu", "error");
    }
  };

  const handleToggleActive = async (menu: Menu) => {
    try {
      const res = await fetch(`/api/menus/${menu.id}/toggle-active`, { method: "POST" });
      const updated = await res.json();
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, active: updated.active } : m)));
      showToast(updated.active ? `${menu.name} is now visible` : `${menu.name} is now hidden`);
    } catch (err) {
      showToast("Failed to update menu", "error");
    }
  };

  const handleAddDrinks = (menu: Menu) => {
    setSelectedMenu(menu);
    setShowAddDrinksModal(true);
  };

  const handleAddDrinkToMenu = async (drinkId: number) => {
    if (!selectedMenu) return;

    try {
      await fetch(`/api/menus/${selectedMenu.id}/drinks/${drinkId}`, { method: "POST" });
      // Refresh menus
      fetchData();
      showToast("Drink added to menu");
    } catch (err) {
      showToast("Failed to add drink", "error");
    }
  };

  const handleRemoveDrinkFromMenu = async (menu: Menu, drinkId: number) => {
    try {
      await fetch(`/api/menus/${menu.id}/drinks/${drinkId}`, { method: "DELETE" });
      setMenus((prev) =>
        prev.map((m) =>
          m.id === menu.id
            ? { ...m, drinks: m.drinks.filter((d) => d.id !== drinkId) }
            : m
        )
      );
      showToast("Drink removed from menu");
    } catch (err) {
      showToast("Failed to remove drink", "error");
    }
  };

  const handleToggleDrinkHidden = async (menu: Menu, drinkId: number) => {
    try {
      await fetch(`/api/menus/${menu.id}/drinks/${drinkId}/toggle-hidden`, { method: "POST" });
      setMenus((prev) =>
        prev.map((m) =>
          m.id === menu.id
            ? {
                ...m,
                drinks: m.drinks.map((d) =>
                  d.id === drinkId ? { ...d, menu_hidden: d.menu_hidden === 1 ? 0 : 1 } : d
                ),
              }
            : m
        )
      );
      showToast("Drink visibility updated");
    } catch (err) {
      showToast("Failed to update drink", "error");
    }
  };

  // Get drinks not already in selected menu
  const getAvailableDrinks = () => {
    if (!selectedMenu) return drinks;
    const menuDrinkIds = new Set(selectedMenu.drinks.map((d) => d.id));
    return drinks.filter((d) => !menuDrinkIds.has(d.id));
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
        <h1>Manage Menus</h1>
        <button className="btn btn-primary" onClick={handleAdd}>
          + New Menu
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No menus yet</p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
            Create menus to organize your drinks for guests
          </p>
          <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: "1rem" }}>
            Create your first menu
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {menus.map((menu) => (
            <div key={menu.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>{menu.name}</h2>
                    {menu.active === 0 && (
                      <span className="badge badge-danger">Hidden</span>
                    )}
                  </div>
                  {menu.description && (
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      {menu.description}
                    </p>
                  )}
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                    {menu.drinks.length} drink{menu.drinks.length !== 1 ? "s" : ""} •{" "}
                    {menu.drinks.filter((d) => d.canMake).length} available
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleActive(menu)}
                  >
                    {menu.active ? "Hide" : "Show"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(menu)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(menu)}
                  >
                    X
                  </button>
                </div>
              </div>

              {/* Menu drinks */}
              {menu.drinks.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                  No drinks in this menu yet
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                  {menu.drinks.map((drink) => (
                    <div
                      key={drink.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "var(--bg-secondary)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        opacity: drink.menu_hidden === 1 ? 0.5 : 1,
                      }}
                    >
                      <span>{drink.name}</span>
                      {!drink.canMake && (
                        <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>!</span>
                      )}
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          padding: "0 0.25rem",
                        }}
                        onClick={() => handleToggleDrinkHidden(menu, drink.id)}
                        title={drink.menu_hidden ? "Show drink" : "Hide drink"}
                      >
                        {drink.menu_hidden ? "👁️" : "👁️‍🗨️"}
                      </button>
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--danger)",
                          cursor: "pointer",
                          padding: "0 0.25rem",
                        }}
                        onClick={() => handleRemoveDrinkFromMenu(menu, drink.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleAddDrinks(menu)}
              >
                + Add Drinks
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Menu Modal */}
      {showModal && (
        <div className="modal-overlay" onMouseDown={() => setShowModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{editingMenu ? "Edit Menu" : "Create Menu"}</h2>

            <div className="form-group">
              <label className="label">Menu Name</label>
              <input
                className="input"
                placeholder="e.g. House Favorites"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label">Description (optional)</label>
              <textarea
                className="textarea"
                placeholder="A brief description of this menu..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

      {/* Add Drinks Modal */}
      {showAddDrinksModal && selectedMenu && (
        <div className="modal-overlay" onMouseDown={() => setShowAddDrinksModal(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h2 className="modal-title">Add Drinks to {selectedMenu.name}</h2>

            {getAvailableDrinks().length === 0 ? (
              <p style={{ color: "var(--text-secondary)" }}>
                All drinks are already in this menu. Add more drinks in the Drinks section.
              </p>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {getAvailableDrinks().map((drink) => (
                  <div
                    key={drink.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {drink.image_path && (
                        <img
                          src={drink.image_path}
                          alt={drink.name}
                          style={{ width: "40px", height: "40px", borderRadius: "0.5rem", objectFit: "cover" }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{drink.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{drink.category}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAddDrinkToMenu(drink.id)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "1rem" }}
              onClick={() => setShowAddDrinksModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
