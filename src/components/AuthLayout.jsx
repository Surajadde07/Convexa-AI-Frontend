import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated } from "../services/api";

// ─────────────────────────────────────────
//  GLOBAL STYLES  (same keyframes as LandingPage)
// ─────────────────────────────────────────
const authStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; height: 100%; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #05050a;
    color: #e2e8f0;
    overflow-x: hidden;
    min-height: 100vh;
  }

  .font-display { font-family: 'Syne', sans-serif; }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(3deg); }
  }
  @keyframes float2 {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(14px) rotate(-2deg); }
  }
  @keyframes float3 {
    0%, 100% { transform: translateY(0px) scale(1); }
    50% { transform: translateY(-12px) scale(1.03); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px 4px rgba(139,92,246,0.3); }
    50% { box-shadow: 0 0 50px 10px rgba(139,92,246,0.55); }
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeRight {
    from { opacity: 0; transform: translateX(-28px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes blob-drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(40px, -30px) scale(1.07); }
    66%       { transform: translate(-25px, 20px) scale(0.96); }
  }
  @keyframes card-float {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50%       { transform: translateY(-10px) rotate(1deg); }
  }
  @keyframes card-float2 {
    0%, 100% { transform: translateY(0) rotate(1deg); }
    50%       { transform: translateY(-8px) rotate(-1deg); }
  }
  @keyframes score-fill {
    from { stroke-dashoffset: 226; }
    to   { stroke-dashoffset: 56; }
  }

  .animate-float  { animation: float  6s ease-in-out infinite; }
  .animate-float2 { animation: float2 8s ease-in-out infinite; }
  .animate-float3 { animation: float3 7s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradientShift 4s ease infinite;
  }
  .animate-fade-up   { animation: fadeUp   0.65s ease forwards; }
  .animate-fade-right{ animation: fadeRight 0.65s ease forwards; }
  .animate-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }
  .animate-spin-slow { animation: spin-slow 12s linear infinite; }
  .animate-blink     { animation: blink 1.1s step-end infinite; }
  .animate-blob      { animation: blob-drift 14s ease-in-out infinite; }
  .animate-card-float  { animation: card-float  5s ease-in-out infinite; }
  .animate-card-float2 { animation: card-float2 7s ease-in-out infinite; }
  .animate-score-fill  {
    animation: score-fill 1.6s cubic-bezier(.4,0,.2,1) 0.4s forwards;
  }

  /* Glass utilities */
  .glass {
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .glass-strong {
    background: rgba(255,255,255,0.07);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border: 1px solid rgba(255,255,255,0.12);
  }

  /* Gradient text */
  .gradient-text {
    background: linear-gradient(135deg, #a78bfa 0%, #6366f1 40%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Gradient border pseudo */
  .gradient-border {
    position: relative;
  }
  .gradient-border::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, rgba(167,139,250,0.6), rgba(99,102,241,0.3), rgba(56,189,248,0.6));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  /* Button shine sweep */
  .btn-glow {
    position: relative;
    overflow: hidden;
  }
  .btn-glow::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transform: skewX(-20deg);
    transition: left 0.6s ease;
  }
  .btn-glow:hover::before { left: 160%; }

  /* Input focus glow */
  .input-field {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    color: #e2e8f0;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    padding: 13px 16px;
    width: 100%;
    transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
    outline: none;
  }
  .input-field::placeholder { color: rgba(226,232,240,0.3); }
  .input-field:focus {
    border-color: rgba(139,92,246,0.6);
    box-shadow: 0 0 0 3px rgba(139,92,246,0.12), 0 0 20px rgba(139,92,246,0.08);
    background: rgba(255,255,255,0.07);
  }
  .input-field.error {
    border-color: rgba(239,68,68,0.6);
    box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
  }
  .input-field.success {
    border-color: rgba(34,197,94,0.5);
    box-shadow: 0 0 0 3px rgba(34,197,94,0.08);
  }

  /* Stagger delays */
  .delay-100 { animation-delay: 0.1s; opacity: 0; }
  .delay-200 { animation-delay: 0.2s; opacity: 0; }
  .delay-300 { animation-delay: 0.3s; opacity: 0; }
  .delay-400 { animation-delay: 0.4s; opacity: 0; }
  .delay-500 { animation-delay: 0.5s; opacity: 0; }
  .delay-600 { animation-delay: 0.6s; opacity: 0; }
  .delay-700 { animation-delay: 0.7s; opacity: 0; }
`;

// ─────────────────────────────────────────
//  BACKGROUND ORBS  (identical to landing)
// ─────────────────────────────────────────
function BgOrbs() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* Top-left purple */}
      <div className="animate-blob" style={{
        position: "absolute", top: "-15%", left: "-10%",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
        filter: "blur(60px)",
      }} />
      {/* Top-right blue */}
      <div className="animate-blob" style={{
        position: "absolute", top: "5%", right: "-15%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)",
        filter: "blur(60px)",
        animationDelay: "4s",
      }} />
      {/* Bottom indigo */}
      <div className="animate-blob" style={{
        position: "absolute", bottom: "-20%", left: "30%",
        width: 800, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)",
        filter: "blur(80px)",
        animationDelay: "8s",
      }} />
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "64px 64px",
      }} />
    </div>
  );
}

// ─────────────────────────────────────────
//  EXPORTED LAYOUT SHELL
// ─────────────────────────────────────────
export default function AuthLayout({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect already-authenticated users away from auth pages
    if (isAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  return (
    <>
      <style>{authStyles}</style>
      <div style={{
        background: "#05050a",
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "stretch",
      }}>
        <BgOrbs />
        <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex" }}>
          {children}
        </div>
      </div>
    </>
  );
}

// Re-export styles so pages can inject extra page-specific keyframes
export { authStyles };
