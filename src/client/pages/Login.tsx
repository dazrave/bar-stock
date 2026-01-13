import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const [code, setCode] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login, session } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (session.type === "owner") {
      navigate("/stock");
    } else if (session.type === "guest") {
      navigate("/menu");
    }
  }, [session, navigate]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newCode.every((d) => d) && index === 3) {
      handleSubmit(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (passcode: string) => {
    setLoading(true);
    const result = await login(passcode);
    setLoading(false);

    if (result.success) {
      if (result.type === "owner") {
        navigate("/stock");
      } else {
        navigate("/menu");
      }
    } else {
      setError(result.error || "Invalid passcode");
      setCode(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🍸</div>
        <h1 style={{ fontSize: "2.5rem", margin: 0, fontWeight: 800 }}>BarStock</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>Enter your passcode</p>
      </div>

      <div className="passcode-container">
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="passcode-digit"
            disabled={loading}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && (
        <p style={{ color: "var(--danger)", marginTop: "1rem", textAlign: "center" }}>{error}</p>
      )}

      {loading && (
        <div style={{ marginTop: "1.5rem" }}>
          <div className="spinner" />
        </div>
      )}

      <p style={{ color: "var(--text-secondary)", marginTop: "3rem", fontSize: "0.875rem", textAlign: "center" }}>
        Owner or guest? Enter your code above.
      </p>
    </div>
  );
}
