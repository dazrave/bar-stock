import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { App } from "./App";
import { Login } from "./pages/Login";
import { Stock } from "./pages/Stock";
import { Drinks } from "./pages/Drinks";
import { Menu } from "./pages/Menu";
import { Settings } from "./pages/Settings";
import { Browse } from "./pages/Browse";
import { Shopping } from "./pages/Shopping";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import "./styles.css";

function ProtectedRoute({ children, ownerOnly = false }: { children: React.ReactNode; ownerOnly?: boolean }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!session?.type) {
    return <Navigate to="/" replace />;
  }

  if (ownerOnly && session.type !== "owner") {
    return <Navigate to="/menu" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/stock"
        element={
          <ProtectedRoute ownerOnly>
            <App>
              <Stock />
            </App>
          </ProtectedRoute>
        }
      />
      <Route
        path="/shopping"
        element={
          <ProtectedRoute ownerOnly>
            <App>
              <Shopping />
            </App>
          </ProtectedRoute>
        }
      />
      <Route
        path="/drinks"
        element={
          <ProtectedRoute ownerOnly>
            <App>
              <Drinks />
            </App>
          </ProtectedRoute>
        }
      />
      <Route
        path="/browse"
        element={
          <ProtectedRoute ownerOnly>
            <App>
              <Browse />
            </App>
          </ProtectedRoute>
        }
      />
      <Route
        path="/menu"
        element={
          <ProtectedRoute>
            <App>
              <Menu />
            </App>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute ownerOnly>
            <App>
              <Settings />
            </App>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<Root />);
