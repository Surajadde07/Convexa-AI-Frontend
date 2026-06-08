import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authAPI, storeSession } from "../services/api";
import logo from "../assets/CONVEXA_AI_logo.png";

// ─────────────────────────────────────────
//  LEFT PANEL — AI preview widgets
// ─────────────────────────────────────────
function LeftPanel() {
  return (
    <div style={{
      flex: "0 0 52%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "60px 56px",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Logo */}
      <div className="animate-fade-right delay-100" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 52 }}>
        <img src={logo} alt="Convexa AI" style={{ height: 48, width: "auto", objectFit: "contain" }} />
        <span className="font-display" style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
          Convexa AI
        </span>
      </div>

      {/* Hero copy */}
      <h1 className="font-display animate-fade-right delay-200" style={{
        fontSize: "clamp(28px, 3.2vw, 48px)",
        fontWeight: 800,
        color: "#fff",
        lineHeight: 1.1,
        letterSpacing: "-0.04em",
        marginBottom: 20,
        maxWidth: 480,
      }}>
        Turn every call into{" "}
        <span className="gradient-text">actionable intelligence</span>
      </h1>

      <p className="animate-fade-right delay-300" style={{
        fontSize: 16,
        color: "rgba(226,232,240,0.55)",
        lineHeight: 1.75,
        maxWidth: 400,
        marginBottom: 52,
      }}>
        AI-powered conversation analysis. Real-time sentiment, QA scoring, and
        business insights — all from your support calls.
      </p>

      {/* Floating AI cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "100%", maxWidth: 500 }}>

        {/* Sentiment Card */}
        <div className="glass gradient-border animate-card-float animate-fade-up delay-300" style={{
          borderRadius: 20,
          padding: "20px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>😊</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(226,232,240,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Sentiment</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Positive", val: 72, color: "#34d399" },
              { label: "Neutral",  val: 18, color: "#94a3b8" },
              { label: "Negative", val: 10, color: "#f87171" },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "rgba(226,232,240,0.5)" }}>{label}</span>
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>{val}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    background: `linear-gradient(90deg, ${color}, ${color}88)`,
                    width: `${val}%`,
                    transition: "width 1s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* QA Score Card */}
        <div className="glass gradient-border animate-card-float2 animate-fade-up delay-400" style={{
          borderRadius: 20,
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, alignSelf: "flex-start" }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>⭐</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(226,232,240,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>QA Score</span>
          </div>
          {/* Circular progress */}
          <div style={{ position: "relative", width: 80, height: 80, marginBottom: 12 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="36" fill="none"
                stroke="url(#qa-grad)" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="226"
                strokeDashoffset="56"
                transform="rotate(-90 40 40)"
                className="animate-score-fill"
                style={{ strokeDashoffset: 56 }}
              />
              <defs>
                <linearGradient id="qa-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>92</span>
              <span style={{ fontSize: 9, color: "rgba(226,232,240,0.4)" }}>/100</span>
            </div>
          </div>
          <span style={{ fontSize: 11, color: "rgba(226,232,240,0.4)" }}>Avg agent score</span>
        </div>

        {/* AI Insights Card */}
        <div className="glass gradient-border animate-fade-up delay-500" style={{
          borderRadius: 20,
          padding: "18px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #f59e0b, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>🧠</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(226,232,240,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>AI Insight</span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(226,232,240,0.65)", lineHeight: 1.6 }}>
            Customers mention <span style={{ color: "#a78bfa", fontWeight: 600 }}>"slow response"</span> in 38% of negative calls this week.
          </p>
          <div style={{
            marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(124,58,237,0.15)", borderRadius: 6,
            padding: "4px 10px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
            <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>Action recommended</span>
          </div>
        </div>

        {/* Analytics Card */}
        <div className="glass gradient-border animate-fade-up delay-600" style={{
          borderRadius: 20,
          padding: "18px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #10b981, #0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>📊</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(226,232,240,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Analytics</span>
          </div>
          {/* Mini bar chart */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 44 }}>
            {[30, 55, 40, 75, 50, 90, 65].map((h, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: "3px 3px 0 0",
                background: i === 5
                  ? "linear-gradient(180deg, #a78bfa, #6366f1)"
                  : "rgba(255,255,255,0.12)",
                height: `${h}%`,
                transition: "height 0.5s ease",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 10, color: "rgba(226,232,240,0.3)" }}>Mon</span>
            <span style={{ fontSize: 10, color: "rgba(226,232,240,0.3)" }}>Sun</span>
          </div>
        </div>

      </div>

      {/* Bottom badge */}
      <div className="animate-fade-up delay-700" style={{
        marginTop: 36,
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 40, padding: "8px 18px",
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#34d399",
          boxShadow: "0 0 8px rgba(52,211,153,0.6)",
        }} />
        <span style={{ fontSize: 12, color: "rgba(226,232,240,0.5)" }}>
          Trusted by <strong style={{ color: "#e2e8f0" }}>500+</strong> support teams worldwide
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  INPUT COMPONENT
// ─────────────────────────────────────────
function AuthInput({ label, type = "text", value, onChange, placeholder, error, icon, rightElement }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "rgba(226,232,240,0.65)", letterSpacing: "0.02em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {icon && (
          <span style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            fontSize: 15, opacity: 0.4, pointerEvents: "none", zIndex: 1,
          }}>{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`input-field${error ? " error" : ""}`}
          style={{ paddingLeft: icon ? 42 : 16, paddingRight: rightElement ? 48 : 16 }}
        />
        {rightElement && (
          <span style={{
            position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
            cursor: "pointer", zIndex: 1,
          }}>{rightElement}</span>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}>
          <span>⚠</span> {error}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  LOGIN FORM
// ─────────────────────────────────────────
function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [form, setForm]       = useState({ email: "", password: "" });
  const [errors, setErrors]   = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess]   = useState(false);

  const set = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
    if (apiError) setApiError("");
  };

  const validate = () => {
    const errs = {};
    if (!form.email.trim())                          errs.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.password)                              errs.password = "Password is required";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");

    try {
      const res = await authAPI.login({ email: form.email, password: form.password });
      storeSession(res.data);
      setSuccess(true);
      setTimeout(() => navigate(from, { replace: true }), 800);
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.error
        || "Invalid credentials. Please try again.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* API error banner */}
      {apiError && (
        <div style={{
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#fca5a5" }}>{apiError}</span>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div style={{
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 15 }}>✅</span>
          <span style={{ fontSize: 13, color: "#86efac" }}>Login successful! Redirecting…</span>
        </div>
      )}

      <AuthInput
        label="Email address"
        type="email"
        value={form.email}
        onChange={set("email")}
        placeholder="you@company.com"
        error={errors.email}
        icon="✉️"
      />

      <AuthInput
        label="Password"
        type={showPwd ? "text" : "password"}
        value={form.password}
        onChange={set("password")}
        placeholder="••••••••"
        error={errors.password}
        icon="🔒"
        rightElement={
          <button
            type="button"
            onClick={() => setShowPwd((p) => !p)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 15, opacity: 0.45, color: "#e2e8f0",
              padding: 0, transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.9)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.45)}
          >
            {showPwd ? "🙈" : "👁️"}
          </button>
        }
      />

      {/* Forgot password */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -12 }}>
        <Link to="/forgot-password" style={{
          fontSize: 13, color: "#a78bfa", textDecoration: "none",
          transition: "color 0.2s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c4b5fd")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a78bfa")}
        >
          Forgot password?
        </Link>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || success}
        className="btn-glow"
        style={{
          width: "100%", padding: "14px", borderRadius: 14,
          fontSize: 16, fontWeight: 700, cursor: loading || success ? "not-allowed" : "pointer",
          border: "none", color: "#fff",
          background: loading || success
            ? "rgba(124,58,237,0.5)"
            : "linear-gradient(135deg, #7c3aed, #4f46e5)",
          boxShadow: loading || success ? "none" : "0 10px 40px rgba(124,58,237,0.4)",
          transition: "all 0.3s ease",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff", borderRadius: "50%",
              display: "inline-block", animation: "spin-slow 0.8s linear infinite",
            }} />
            Signing in…
          </>
        ) : success ? (
          "✓ Signed in!"
        ) : (
          "Sign in to Convexa AI →"
        )}
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        <span style={{ fontSize: 12, color: "rgba(226,232,240,0.3)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      </div>

      {/* Sign up link */}
      <p style={{ textAlign: "center", fontSize: 14, color: "rgba(226,232,240,0.45)" }}>
        New to Convexa AI?{" "}
        <Link to="/register" style={{
          color: "#a78bfa", fontWeight: 600, textDecoration: "none",
          transition: "color 0.2s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c4b5fd")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a78bfa")}
        >
          Create an account
        </Link>
      </p>

    </div>
  );
}

// ─────────────────────────────────────────
//  RIGHT PANEL — form container
// ─────────────────────────────────────────
function RightPanel() {
  return (
    <div style={{
      flex: "0 0 48%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 48px",
      position: "relative",
    }}>
      {/* Subtle vertical separator */}
      <div style={{
        position: "absolute", left: 0, top: "10%", height: "80%", width: 1,
        background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.07), transparent)",
      }} />

      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Card */}
        <div className="glass-strong gradient-border animate-fade-up" style={{
          borderRadius: 28,
          padding: "44px 40px",
        }}>

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 40, padding: "5px 14px", marginBottom: 20,
            }}>
              <span style={{ fontSize: 10 }}>🔐</span>
              <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Secure Login
              </span>
            </div>

            <h2 className="font-display" style={{
              fontSize: 28, fontWeight: 800, color: "#fff",
              letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8,
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: "rgba(226,232,240,0.45)", lineHeight: 1.6 }}>
              Sign in to your workspace and pick up where you left off.
            </p>
          </div>

          <LoginForm />
        </div>

        {/* Security note */}
        <p style={{
          textAlign: "center", fontSize: 12, color: "rgba(226,232,240,0.2)",
          marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <span>🔒</span> 256-bit SSL encrypted · SOC 2 compliant
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  MOBILE VIEW  (stacked)
// ─────────────────────────────────────────
function MobileLogin() {
  return (
    <div style={{
      width: "100%",
      padding: "40px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
        <img src={logo} alt="Convexa AI" style={{ height: 40, width: "auto" }} />
        <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Convexa AI</span>
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="glass-strong gradient-border" style={{ borderRadius: 24, padding: "36px 28px" }}>
          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.03em" }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 13, color: "rgba(226,232,240,0.4)", marginBottom: 28 }}>
            Sign in to your Convexa AI workspace
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  PAGE EXPORT
// ─────────────────────────────────────────
export default function LoginPage() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 900
  );

  // Simple resize listener
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => setIsMobile(window.innerWidth < 900), { passive: true });
  }

  return (
    <AuthLayout>
      {isMobile ? (
        <MobileLogin />
      ) : (
        <div style={{ display: "flex", width: "100%", minHeight: "100vh" }}>
          <LeftPanel />
          <RightPanel />
        </div>
      )}
    </AuthLayout>
  );
}
