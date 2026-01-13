import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

interface AppProps {
  children: React.ReactNode;
}

export function App({ children }: AppProps) {
  const { session } = useAuth();
  const isOwner = session?.type === "owner";

  return (
    <>
      {children}
      <nav className="nav">
        {isOwner ? (
          <>
            <NavLink to="/stock" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">🍾</span>
              <span>Stock</span>
            </NavLink>
            <NavLink to="/shopping" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">🛒</span>
              <span>Shop</span>
            </NavLink>
            <NavLink to="/drinks" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">🍹</span>
              <span>Drinks</span>
            </NavLink>
            <NavLink to="/menus" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">📋</span>
              <span>Menus</span>
            </NavLink>
            <NavLink to="/queue" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">📝</span>
              <span>Queue</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">⚙️</span>
              <span>Settings</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/menu" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">📋</span>
              <span>Menu</span>
            </NavLink>
            <NavLink to="/queue" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon">📝</span>
              <span>Queue</span>
            </NavLink>
          </>
        )}
      </nav>
    </>
  );
}
