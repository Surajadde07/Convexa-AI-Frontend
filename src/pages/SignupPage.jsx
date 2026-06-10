import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authAPI, storeSession } from "../services/api";
import logo from "../assets/CONVEXA_AI_logo.png";

// ─────────────────────────────────────────
//  GOOGLE BUTTON (same component as LoginPage)
// ─────────────────────────────────────────
function GoogleAuthButton({ label, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(() => {
    if (!window.google?.accounts?.id) {
      onError("Google Sign-In is not available. Please try again.");
      return;
    }
    setLoading(true);
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const res = await authAPI.googleLogin({ credential: response.credential });
          storeSession(res.data);
          onSuccess();
        } catch (err) {
          onError(
            err.response?.data?.message ||
            err.response?.data?.error ||
            "Google sign-up failed. Please try again."
          );
        } finally {
          setLoading(false);
        }
      },
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn-" + label.replace(/\s/g, "")),
          { theme: "filled_black", size: "large", width: 360 }
        );
        setLoading(false);
      }
    });
  }, [label, onSuccess, onError]);

  return (
    <>
      <div id={"google-signin-btn-" + label.replace(/\s/g, "")} style={{ display: "none" }} />
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          width: "100%", padding: "13px 16px", borderRadius: 14,
          fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          border: "1px solid rgba(255,255,255,0.12)", color: "#e2e8f0",
          background: loading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          transition: "all 0.2s ease",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = "rgba(255,255,255,0.11)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = loading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 16, height: 16, border: "2px solid rgba(255,255,255,0.25)",
              borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
              animation: "spin-slow 0.8s linear infinite",
            }} />
            Connecting…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <g>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </g>
            </svg>
            {label}
          </>
        )}
      </button>
    </>
  );
}


// ─────────────────────────────────────────
//  PASSWORD STRENGTH
// ─────────────────────────────────────────
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8)             score++;
  if (pw.length >= 12)            score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;

  if (score <= 1) return { score: 1, label: "Weak",      color: "#f87171" };
  if (score === 2) return { score: 2, label: "Fair",      color: "#fb923c" };
  if (score === 3) return { score: 3, label: "Good",      color: "#facc15" };
  if (score === 4) return { score: 4, label: "Strong",    color: "#4ade80" };
  return             { score: 5, label: "Excellent",  color: "#34d399" };
}

function PasswordStrengthBar({ password }) {
  const { score, label, color } = useMemo(() => getPasswordStrength(password), [password]);
  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 3,
            background: i <= score ? color : "rgba(255,255,255,0.08)",
            transition: "background 0.3s ease",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────
function AuthInput({ label, type = "text", value, onChange, placeholder, error, icon, rightElement, hint }) {
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
      {hint && !error && (
        <span style={{ fontSize: 11, color: "rgba(226,232,240,0.3)" }}>{hint}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  LEFT PANEL — value props
// ─────────────────────────────────────────
function LeftPanel() {
  const features = [
    { icon: "🎙️", title: "Speech-to-Text", desc: "Whisper-powered transcription with speaker detection" },
    { icon: "🧠", title: "AI Summaries",   desc: "Instant call summaries with key action items" },
    { icon: "😊", title: "Sentiment Analysis", desc: "Real-time emotional intelligence on every call" },
    { icon: "📊", title: "QA Scoring",     desc: "Automated quality assurance across all agents" },
    { icon: "💡", title: "Business Insights", desc: "Trends, patterns and executive-level reports" },
  ];

  return (
    <div style={{
      flex: "0 0 48%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "60px 56px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div className="animate-fade-right delay-100" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 44 }}>
        <img src={logo} alt="Convexa AI" style={{ height: 44, width: "auto", objectFit: "contain" }} />
        <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
          Convexa AI
        </span>
      </div>

      {/* Hero */}
      <h1 className="font-display animate-fade-right delay-200" style={{
        fontSize: "clamp(26px, 2.8vw, 42px)",
        fontWeight: 800, color: "#fff",
        lineHeight: 1.1, letterSpacing: "-0.04em",
        marginBottom: 16, maxWidth: 440,
      }}>
        Start decoding calls in{" "}
        <span className="gradient-text">minutes, not months</span>
      </h1>

      <p className="animate-fade-right delay-300" style={{
        fontSize: 15, color: "rgba(226,232,240,0.5)",
        lineHeight: 1.75, maxWidth: 380, marginBottom: 44,
      }}>
        No lengthy setup. Upload your first call and get AI-powered analysis instantly.
      </p>

      {/* Feature list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {features.map(({ icon, title, desc }, i) => (
          <div
            key={title}
            className={`animate-fade-right`}
            style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              animationDelay: `${0.3 + i * 0.08}s`, opacity: 0,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: "rgba(226,232,240,0.4)", lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div className="animate-fade-up delay-700" style={{
        marginTop: 44,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{ display: "flex" }}>
          {["#7c3aed", "#4f46e5", "#0ea5e9"].map((c, i) => (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: "50%",
              background: `linear-gradient(135deg, ${c}, ${c}88)`,
              border: "2px solid #05050a",
              marginLeft: i > 0 ? -8 : 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "#fff", fontWeight: 700,
            }}>
              {["A", "B", "C"][i]}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>
            Join 500+ support teams
          </div>
          <div style={{ fontSize: 11, color: "rgba(226,232,240,0.35)" }}>
            Free to start — no credit card required
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  SIGNUP FORM
// ─────────────────────────────────────────
function SignupForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "", terms: false,
  });
  const [errors, setErrors]     = useState({});
  const [showPwd, setShowPwd]   = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess]   = useState(false);

  const set = (field) => (e) => {
    const val = field === "terms" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [field]: val }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
    if (apiError) setApiError("");
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())
      errs.name = "Full name is required";
    else if (form.name.trim().length < 2)
      errs.name = "Name must be at least 2 characters";

    if (!form.email.trim())
      errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email address";

    if (!form.password)
      errs.password = "Password is required";
    else if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters";

    if (!form.confirmPassword)
      errs.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword)
      errs.confirmPassword = "Passwords do not match";

    if (!form.terms)
      errs.terms = "You must accept the Terms & Conditions";

    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");

    try {
      const res = await authAPI.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      storeSession(res.data);
      setSuccess(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.error
        || "Registration failed. Please try again.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {apiError && (
        <div style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#fca5a5" }}>{apiError}</span>
        </div>
      )}

      {success && (
        <div style={{
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 15 }}>🎉</span>
          <span style={{ fontSize: 13, color: "#86efac" }}>Account created! Redirecting to dashboard…</span>
        </div>
      )}

      <AuthInput
        label="Full name"
        value={form.name}
        onChange={set("name")}
        placeholder="Alex Johnson"
        error={errors.name}
        icon="👤"
      />

      <AuthInput
        label="Work email"
        type="email"
        value={form.email}
        onChange={set("email")}
        placeholder="alex@company.com"
        error={errors.email}
        icon="✉️"
      />

      <div>
        <AuthInput
          label="Password"
          type={showPwd ? "text" : "password"}
          value={form.password}
          onChange={set("password")}
          placeholder="Min. 8 characters"
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
        <PasswordStrengthBar password={form.password} />
      </div>

      <AuthInput
        label="Confirm password"
        type={showCPwd ? "text" : "password"}
        value={form.confirmPassword}
        onChange={set("confirmPassword")}
        placeholder="Repeat your password"
        error={errors.confirmPassword}
        icon="🔑"
        rightElement={
          <button
            type="button"
            onClick={() => setShowCPwd((p) => !p)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 15, opacity: 0.45, color: "#e2e8f0",
              padding: 0, transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.9)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.45)}
          >
            {showCPwd ? "🙈" : "👁️"}
          </button>
        }
      />

      {/* Terms checkbox */}
      <div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
          <div
            onClick={() => setForm((p) => ({ ...p, terms: !p.terms }))}
            style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
              border: errors.terms
                ? "1.5px solid rgba(239,68,68,0.6)"
                : form.terms
                  ? "1.5px solid #7c3aed"
                  : "1.5px solid rgba(255,255,255,0.15)",
              background: form.terms
                ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                : "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {form.terms && <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13, color: "rgba(226,232,240,0.5)", lineHeight: 1.6 }}>
            I agree to the{" "}
            <Link to="/terms" style={{ color: "#a78bfa", textDecoration: "none" }}>Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" style={{ color: "#a78bfa", textDecoration: "none" }}>Privacy Policy</Link>
          </span>
        </label>
        {errors.terms && (
          <span style={{ fontSize: 12, color: "#f87171", marginTop: 4, display: "block" }}>
            ⚠ {errors.terms}
          </span>
        )}
      </div>

      {/* ── Google Sign-Up (primary CTA) ── */}
      <GoogleAuthButton
        label="Sign up with Google"
        onSuccess={() => {
          setSuccess(true);
          setTimeout(() => navigate("/dashboard", { replace: true }), 600);
        }}
        onError={(msg) => setApiError(msg)}
      />

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        <span style={{ fontSize: 12, color: "rgba(226,232,240,0.3)" }}>or sign up with email</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
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
            Creating account…
          </>
        ) : success ? (
          "🎉 Account created!"
        ) : (
          "Create free account →"
        )}
      </button>

      {/* Login link */}
      <p style={{ textAlign: "center", fontSize: 14, color: "rgba(226,232,240,0.45)" }}>
        Already have an account?{" "}
        <Link to="/login" style={{
          color: "#a78bfa", fontWeight: 600, textDecoration: "none",
          transition: "color 0.2s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c4b5fd")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a78bfa")}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────
//  RIGHT PANEL
// ─────────────────────────────────────────
function RightPanel() {
  return (
    <div style={{
      flex: "0 0 52%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 48px",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", left: 0, top: "10%", height: "80%", width: 1,
        background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.07), transparent)",
      }} />

      <div style={{ width: "100%", maxWidth: 440 }}>
        <div className="glass-strong gradient-border animate-fade-up" style={{
          borderRadius: 28,
          padding: "40px 36px",
        }}>
          <div style={{ marginBottom: 30 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 40, padding: "5px 14px", marginBottom: 18,
            }}>
              <span style={{ fontSize: 10 }}>🚀</span>
              <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Free to start
              </span>
            </div>

            <h2 className="font-display" style={{
              fontSize: 26, fontWeight: 800, color: "#fff",
              letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 8,
            }}>
              Create your account
            </h2>
            <p style={{ fontSize: 14, color: "rgba(226,232,240,0.4)", lineHeight: 1.6 }}>
              Set up your Convexa AI workspace in under 2 minutes.
            </p>
          </div>

          <SignupForm />
        </div>

        <p style={{
          textAlign: "center", fontSize: 12, color: "rgba(226,232,240,0.2)",
          marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <span>🔒</span> Your data is encrypted and never sold
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  MOBILE VIEW
// ─────────────────────────────────────────
function MobileSignup() {
  return (
    <div style={{ width: "100%", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
        <img src={logo} alt="Convexa AI" style={{ height: 40, width: "auto" }} />
        <span className="font-display" style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Convexa AI</span>
      </div>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="glass-strong gradient-border" style={{ borderRadius: 24, padding: "36px 28px" }}>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.03em" }}>
            Create account
          </h2>
          <p style={{ fontSize: 13, color: "rgba(226,232,240,0.4)", marginBottom: 28 }}>
            Start your free Convexa AI workspace
          </p>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  PAGE EXPORT
// ─────────────────────────────────────────
export default function SignupPage() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 900
  );

  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => setIsMobile(window.innerWidth < 900), { passive: true });
  }

  return (
    <AuthLayout>
      {isMobile ? (
        <MobileSignup />
      ) : (
        <div style={{ display: "flex", width: "100%", minHeight: "100vh" }}>
          <LeftPanel />
          <RightPanel />
        </div>
      )}
    </AuthLayout>
  );
}
