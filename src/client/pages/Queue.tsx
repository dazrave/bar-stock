import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface DrinkRequest {
  id: number;
  drink_id: number;
  guest_name: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  drink_name: string;
  drink_image: string | null;
}

export function Queue() {
  const [requests, setRequests] = useState<DrinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [barOpen, setBarOpen] = useState(true);
  const { session } = useAuth();
  const { showToast } = useToast();
  const isOwner = session?.type === "owner";

  useEffect(() => {
    fetchData();
    // Poll for new requests every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [queueRes, statusRes] = await Promise.all([
        fetch("/api/queue"),
        fetch("/api/queue/status"),
      ]);
      const queueData = await queueRes.json();
      const statusData = await statusRes.json();
      setRequests(queueData);
      setBarOpen(statusData.barOpen);
    } catch (err) {
      showToast("Failed to load queue", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBar = async () => {
    try {
      const res = await fetch("/api/queue/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barOpen: !barOpen }),
      });
      const data = await res.json();
      setBarOpen(data.barOpen);
      showToast(data.barOpen ? "Bar is now open!" : "Bar is now closed");
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  const handleMaking = async (request: DrinkRequest) => {
    try {
      await fetch(`/api/queue/${request.id}/making`, { method: "POST" });
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: "making" } : r))
      );
      showToast(`Making ${request.drink_name} for ${request.guest_name}...`);
    } catch (err) {
      showToast("Failed to update request", "error");
    }
  };

  const handleDone = async (request: DrinkRequest) => {
    try {
      await fetch(`/api/queue/${request.id}/done`, { method: "POST" });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      showToast(`${request.drink_name} ready for ${request.guest_name}!`);
    } catch (err) {
      showToast("Failed to complete request", "error");
    }
  };

  const handleDecline = async (request: DrinkRequest) => {
    if (!confirm(`Decline ${request.guest_name}'s request for ${request.drink_name}?`)) return;

    try {
      await fetch(`/api/queue/${request.id}/decline`, { method: "POST" });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      showToast(`Declined ${request.guest_name}'s request`);
    } catch (err) {
      showToast("Failed to decline request", "error");
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const makingRequests = requests.filter((r) => r.status === "making");

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
        <h1>Queue</h1>
        {isOwner && (
          <button
            className={`btn ${barOpen ? "btn-danger" : "btn-success"} btn-sm`}
            onClick={handleToggleBar}
          >
            {barOpen ? "Close Bar" : "Open Bar"}
          </button>
        )}
      </div>

      {/* Bar status banner */}
      <div
        style={{
          background: barOpen ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
          border: `1px solid ${barOpen ? "var(--success)" : "var(--danger)"}`,
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
          textAlign: "center",
        }}
      >
        <strong>{barOpen ? "Bar is Open" : "Bar is Closed"}</strong>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          {barOpen
            ? `${pendingRequests.length} pending, ${makingRequests.length} in progress`
            : "Not accepting new requests"}
        </p>
      </div>

      {/* Making section */}
      {makingRequests.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--warning)", marginBottom: "0.75rem" }}>
            IN PROGRESS ({makingRequests.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {makingRequests.map((request) => (
              <div
                key={request.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem",
                  background: "rgba(234, 179, 8, 0.1)",
                  border: "1px solid var(--warning)",
                }}
              >
                {request.drink_image && (
                  <img
                    src={request.drink_image}
                    alt={request.drink_name}
                    style={{ width: "50px", height: "50px", borderRadius: "0.5rem", objectFit: "cover" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{request.drink_name}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    for {request.guest_name} • {formatTime(request.requested_at)}
                  </div>
                </div>
                {isOwner && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleDone(request)}
                  >
                    Done
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending section */}
      {pendingRequests.length > 0 ? (
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
            PENDING ({pendingRequests.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem",
                }}
              >
                {request.drink_image && (
                  <img
                    src={request.drink_image}
                    alt={request.drink_name}
                    style={{ width: "50px", height: "50px", borderRadius: "0.5rem", objectFit: "cover" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{request.drink_name}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    for {request.guest_name} • {formatTime(request.requested_at)}
                  </div>
                </div>
                {isOwner && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleMaking(request)}
                    >
                      Make
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDecline(request)}
                    >
                      X
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : makingRequests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍹</div>
          <p>No drink requests</p>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
            {barOpen
              ? "Waiting for guests to order..."
              : "Open the bar to accept requests"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
