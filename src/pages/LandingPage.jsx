import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import logo from "../assets/CONVEXA_AI_logo.png";

/* ─────────────────────────────────────────
   INLINE STYLES / KEYFRAMES
───────────────────────────────────────── */
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #05050a;
    color: #e2e8f0;
    overflow-x: hidden;
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
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px 4px rgba(139,92,246,0.3); }
    50% { box-shadow: 0 0 40px 8px rgba(139,92,246,0.6); }
  }
  @keyframes beam {
    0% { transform: translateX(-100%) skewX(-20deg); }
    100% { transform: translateX(400%) skewX(-20deg); }
  }
  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes orbit {
    from { transform: rotate(0deg) translateX(90px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(90px) rotate(-360deg); }
  }
  @keyframes orbit2 {
    from { transform: rotate(120deg) translateX(120px) rotate(-120deg); }
    to   { transform: rotate(480deg) translateX(120px) rotate(-480deg); }
  }
  @keyframes orbit3 {
    from { transform: rotate(240deg) translateX(70px) rotate(-240deg); }
    to   { transform: rotate(600deg) translateX(70px) rotate(-600deg); }
  }
  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-float2 { animation: float2 8s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
  .animate-ticker { animation: ticker 28s linear infinite; }
  .animate-fade-up { animation: fadeUp 0.7s ease forwards; }
  .animate-scale-in { animation: scaleIn 0.6s ease forwards; }
  .animate-gradient { 
    background-size: 200% 200%;
    animation: gradientShift 4s ease infinite; 
  }
  .animate-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }

  .glass {
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .glass-strong {
    background: rgba(255,255,255,0.07);
    backdrop-filter: blur(32px);
    border: 1px solid rgba(255,255,255,0.12);
  }

  .gradient-text {
    background: linear-gradient(135deg, #a78bfa 0%, #6366f1 40%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .gradient-text-warm {
    background: linear-gradient(135deg, #f472b6 0%, #a78bfa 50%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
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

  .noise {
    position: relative;
  }
  .noise::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    border-radius: inherit;
    opacity: 0.4;
  }

  .section-reveal {
    opacity: 0;
    transform: translateY(40px);
    transition: opacity 0.8s ease, transform 0.8s ease;
  }
  .section-reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .card-hover {
    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  }
  .card-hover:hover {
    transform: translateY(-6px);
    box-shadow: 0 24px 60px rgba(139,92,246,0.15);
    border-color: rgba(139,92,246,0.3);
  }

  .btn-glow {
    position: relative;
    overflow: hidden;
  }
  .btn-glow::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transform: skewX(-20deg);
    transition: left 0.6s ease;
  }
  .btn-glow:hover::before {
    left: 160%;
  }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #05050a; }
  ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.4); border-radius: 3px; }
`;

/* ─────────────────────────────────────────
   INTERSECTION OBSERVER HOOK
───────────────────────────────────────── */
function useReveal() {
    useEffect(() => {
        const els = document.querySelectorAll(".section-reveal");
        const observer = new IntersectionObserver(
            (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
            { threshold: 0.12 }
        );
        els.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);
}

/* ─────────────────────────────────────────
   NOISE BG ORBS
───────────────────────────────────────── */
function BgOrbs() {
    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            <div style={{
                position: 'absolute', top: '-20%', left: '-10%',
                width: 700, height: 700, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
                filter: 'blur(60px)'
            }} />
            <div style={{
                position: 'absolute', top: '40%', right: '-15%',
                width: 600, height: 600, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
                filter: 'blur(60px)'
            }} />
            <div style={{
                position: 'absolute', bottom: '10%', left: '30%',
                width: 500, height: 500, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
                filter: 'blur(80px)'
            }} />
        </div>
    );
}

/* ─────────────────────────────────────────
   NAVBAR
───────────────────────────────────────── */
function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 30);
        window.addEventListener("scroll", handler);
        return () => window.removeEventListener("scroll", handler);
    }, []);

    return (
        <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
            transition: 'all 0.3s ease',
            background: scrolled ? 'rgba(5,5,10,0.85)' : 'transparent',
            backdropFilter: scrolled ? 'blur(24px)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>

                    {/* LOGO */}
                    {/* LOGO */}
                    <Link
                        to="/"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            textDecoration: 'none'
                        }}
                    >
                        <img
                            src={logo}
                            alt="Convexa AI"
                            style={{
                                height: 50,
                                width: 'auto',
                                objectFit: 'contain'
                            }}
                        />

                        <span
                            className="font-display"
                            style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: '#fff',
                                letterSpacing: '-0.02em'
                            }}
                        >
                            Convexa <span className="gradient-text">AI</span>
                        </span>
                    </Link>

                    {/* DESKTOP NAV */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="hidden-mobile">
                        {['Features', 'How It Works', 'Pricing', 'About'].map(item => (
                            <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                                    color: 'rgba(226,232,240,0.7)', textDecoration: 'none',
                                    transition: 'color 0.2s ease',
                                }}
                                onMouseEnter={e => e.target.style.color = '#fff'}
                                onMouseLeave={e => e.target.style.color = 'rgba(226,232,240,0.7)'}
                            >{item}</a>
                        ))}
                    </div>

                    {/* CTA */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Link to="/login" style={{
                            padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                            color: 'rgba(226,232,240,0.8)', textDecoration: 'none',
                            border: '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.2s ease',
                        }}
                            onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={e => { e.target.style.color = 'rgba(226,232,240,0.8)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        >Log in</Link>

                        <Link to="/register" className="btn-glow" style={{
                            padding: '9px 20px', borderRadius: 9, fontSize: 14, fontWeight: 600,
                            color: '#fff', textDecoration: 'none',
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.6)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)'; }}
                        >Get Started →</Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}

/* ─────────────────────────────────────────
   HERO
───────────────────────────────────────── */
function Hero() {
    return (
        <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 100 }}>

            {/* Grid pattern */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 0,
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px',
            }} />

            {/* Center glow */}
            <div style={{
                position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
                width: 800, height: 800, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
                filter: 'blur(40px)', zIndex: 0,
            }} />

            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 24px', position: 'relative', zIndex: 1, width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

                    {/* LEFT */}
                    <div style={{ animation: 'fadeUp 0.8s ease both' }}>

                        {/* Badge */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '6px 14px', borderRadius: 100,
                            background: 'rgba(124,58,237,0.12)',
                            border: '1px solid rgba(124,58,237,0.3)',
                            marginBottom: 28,
                        }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%', background: '#7c3aed',
                                boxShadow: '0 0 8px rgba(124,58,237,0.8)', animation: 'pulse-glow 2s infinite'
                            }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Conversation Intelligence Platform
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 className="font-display" style={{ fontSize: 'clamp(42px,5vw,72px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#fff', marginBottom: 24 }}>
                            Every Call
                            <br />
                            <span className="gradient-text">Tells a Story.</span>
                            <br />
                            We Decode It.
                        </h1>

                        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(226,232,240,0.6)', maxWidth: 480, marginBottom: 40 }}>
                            Upload customer calls. Convexa AI instantly returns transcripts, sentiment analysis, QA scores, agent evaluations, and business intelligence — in seconds.
                        </p>

                        {/* CTAs */}
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <Link to="/register" className="btn-glow" style={{
                                padding: '14px 28px', borderRadius: 12, fontSize: 16, fontWeight: 700,
                                color: '#fff', textDecoration: 'none',
                                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                                boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}>
                                Start Free — No Credit Card
                            </Link>
                            <a href="#features" style={{
                                padding: '14px 28px', borderRadius: 12, fontSize: 16, fontWeight: 600,
                                color: 'rgba(226,232,240,0.85)', textDecoration: 'none',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                transition: 'all 0.2s ease',
                            }}>
                                Watch Demo ↗
                            </a>
                        </div>

                        {/* Social proof numbers */}
                        <div style={{ display: 'flex', gap: 32, marginTop: 48 }}>
                            {[
                                { num: '95%', label: 'Transcript Accuracy' },
                                { num: '2min', label: 'Avg. Analysis Time' },
                                { num: '10+', label: 'AI Models' },
                            ].map(stat => (
                                <div key={stat.label}>
                                    <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{stat.num}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.45)', marginTop: 2 }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT — DASHBOARD PREVIEW */}
                    <div style={{ position: 'relative', animation: 'scaleIn 1s ease both', animationDelay: '0.2s' }}>

                        {/* Glow behind card */}
                        <div style={{
                            position: 'absolute', inset: '-30px', borderRadius: 32,
                            background: 'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.25), transparent 70%)',
                            filter: 'blur(30px)', zIndex: 0,
                        }} />

                        {/* Main card */}
                        <div className="gradient-border" style={{
                            position: 'relative', zIndex: 1, borderRadius: 24,
                            background: 'rgba(10,10,20,0.85)',
                            backdropFilter: 'blur(32px)',
                            padding: 24, overflow: 'hidden',
                        }}>
                            {/* Shimmer overlay */}
                            <div className="animate-shimmer" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', borderRadius: 24 }} />

                            {/* Header bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, position: 'relative', zIndex: 1 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 26, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>app.convexa.ai/dashboard</span>
                                </div>
                            </div>

                            {/* Analysis feed */}
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

                                {/* File being processed */}
                                <div style={{
                                    padding: '12px 16px', borderRadius: 12,
                                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎙️</div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>support_call_0847.mp3</div>
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>4.2 MB · 12:34 min</div>
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                                        background: 'rgba(34,197,94,0.15)', color: '#4ade80',
                                        border: '1px solid rgba(34,197,94,0.25)',
                                    }}>✓ Analyzed</div>
                                </div>

                                {/* Metrics grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                                        <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Sentiment</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>POSITIVE</div>
                                        <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                                            <div style={{ width: '78%', height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #4ade80, #22c55e)' }} />
                                        </div>
                                    </div>

                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                        <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>QA Score</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>91 <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>/100</span></div>
                                        <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                                            <div style={{ width: '91%', height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #6366f1, #4f46e5)' }} />
                                        </div>
                                    </div>

                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}>
                                        <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Intent</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>Billing Query → Resolved</div>
                                    </div>

                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.15)' }}>
                                        <div style={{ fontSize: 10, color: '#f472b6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Agent Score</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>A+</div>
                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Top 8% this week</div>
                                    </div>

                                </div>

                                {/* Summary */}
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>AI Summary</div>
                                    <div style={{ fontSize: 13, color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
                                        Customer queried billing cycle. Agent resolved with promotional credit, increasing NPS likelihood.
                                    </div>
                                </div>

                                {/* Keywords */}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {['billing', 'refund', 'retention', 'upsell', 'resolved'].map(kw => (
                                        <span key={kw} style={{
                                            padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                                            background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
                                            border: '1px solid rgba(124,58,237,0.2)',
                                        }}>{kw}</span>
                                    ))}
                                </div>

                            </div>
                        </div>

                        {/* Floating badges */}
                        <div className="animate-float" style={{
                            position: 'absolute', top: -20, right: -24, zIndex: 2,
                            padding: '10px 16px', borderRadius: 12,
                            background: 'rgba(34,197,94,0.12)', backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(34,197,94,0.25)',
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>↑ 24% CSAT this week</div>
                        </div>
                        <div className="animate-float2" style={{
                            position: 'absolute', bottom: 30, left: -28, zIndex: 2,
                            padding: '10px 16px', borderRadius: 12,
                            background: 'rgba(99,102,241,0.12)', backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(99,102,241,0.25)',
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8' }}>⚡ Analysis in ~90s</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   TICKER / TRUSTED BY
───────────────────────────────────────── */
function TrustedBy() {
    const logos = [
        'Salesforce', 'HubSpot', 'Zendesk', 'Intercom', 'Freshworks',
        'Talkdesk', 'NICE', 'Genesys', 'Five9', 'Twilio',
    ];
    return (
        <section style={{ padding: '56px 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
            <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'rgba(226,232,240,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 28 }}>
                Trusted by teams at
            </p>
            <div style={{ position: 'relative', overflow: 'hidden' }}>
                <div className="animate-ticker" style={{ display: 'flex', gap: 56, whiteSpace: 'nowrap' }}>
                    {[...logos, ...logos].map((name, i) => (
                        <span key={i} className="font-display" style={{
                            fontSize: 18, fontWeight: 700, color: 'rgba(226,232,240,0.15)',
                            letterSpacing: '-0.02em', display: 'inline-flex', alignItems: 'center', gap: 8,
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(124,58,237,0.4)', display: 'inline-block' }} />
                            {name}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   PROBLEM SECTION
───────────────────────────────────────── */
function Problem() {
    const problems = [
        { icon: '🕐', title: 'Manual Reviews Take Hours', desc: 'QA analysts spend 4–6 hours daily listening to calls, making it impossible to review more than a fraction.' },
        { icon: '📉', title: 'Inconsistent Scoring', desc: 'Human reviewers have different standards, leading to biased agent evaluations and unfair performance metrics.' },
        { icon: '🙈', title: 'Insights Stay Hidden', desc: 'Critical trends, product issues, and customer complaints buried in thousands of hours of audio — never surfaced.' },
        { icon: '💸', title: 'Missed Revenue Signals', desc: 'Upsell opportunities, churn indicators, and competitor mentions go undetected without intelligent analysis.' },
    ];

    return (
        <section id="problem" style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                <div style={{ maxWidth: 640, marginBottom: 64 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase' }}>The Problem</span>
                    </div>
                    <h2 className="font-display" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>
                        Manual call review is<br />
                        <span style={{ color: '#ef4444' }}>broken by design.</span>
                    </h2>
                    <p style={{ fontSize: 17, color: 'rgba(226,232,240,0.55)', lineHeight: 1.7 }}>
                        Customer calls hold your most valuable business intelligence — but traditional review methods can't scale.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 20 }}>
                    {problems.map((p, i) => (
                        <div key={i} className="card-hover gradient-border" style={{
                            padding: '28px 24px', borderRadius: 20,
                            background: 'rgba(239,68,68,0.04)',
                            border: '1px solid rgba(239,68,68,0.1)',
                            animationDelay: `${i * 0.1}s`,
                        }}>
                            <div style={{ fontSize: 36, marginBottom: 16 }}>{p.icon}</div>
                            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{p.title}</h3>
                            <p style={{ fontSize: 14, color: 'rgba(226,232,240,0.5)', lineHeight: 1.7 }}>{p.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   SOLUTION / HOW IT WORKS
───────────────────────────────────────── */
function HowItWorks() {
    const steps = [
        {
            num: '01', icon: '📤', title: 'Upload Your Calls',
            desc: 'Drag and drop any audio file — MP3, WAV, M4A. Batch uploads supported. Encrypted in transit and at rest.',
            color: '#7c3aed',
        },
        {
            num: '02', icon: '⚙️', title: 'AI Processes Everything',
            desc: 'Whisper transcribes. Ollama extracts intents. NLP models score sentiment. QA engines evaluate agent performance.',
            color: '#4f46e5',
        },
        {
            num: '03', icon: '📊', title: 'Insights, Instantly',
            desc: 'A complete intelligence report: summary, sentiment, QA score, keywords, agent grade — in under 2 minutes.',
            color: '#0ea5e9',
        },
    ];
    return (
        <section id="how-it-works" style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                <div style={{ textAlign: 'center', marginBottom: 80 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>How It Works</span>
                    </div>
                    <h2 className="font-display" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                        From audio file to{' '}
                        <span className="gradient-text">full intelligence</span>
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 32, position: 'relative' }}>

                    {/* Connector line */}
                    <div style={{
                        position: 'absolute', top: 60, left: '16.5%', right: '16.5%', height: 1,
                        background: 'linear-gradient(90deg, rgba(124,58,237,0.4), rgba(14,165,233,0.4))',
                        display: 'none', // hide on mobile; shown via CSS would need a media query
                    }} />

                    {steps.map((s, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                            {/* Number */}
                            <div className="font-display" style={{ fontSize: 72, fontWeight: 800, color: 'rgba(255,255,255,0.04)', position: 'absolute', top: -20, left: -10, lineHeight: 1 }}>{s.num}</div>

                            <div className="card-hover gradient-border" style={{
                                padding: '36px 28px', borderRadius: 24,
                                background: `rgba(${s.color === '#7c3aed' ? '124,58,237' : s.color === '#4f46e5' ? '79,70,229' : '14,165,233'},0.06)`,
                                border: `1px solid rgba(${s.color === '#7c3aed' ? '124,58,237' : s.color === '#4f46e5' ? '79,70,229' : '14,165,233'},0.15)`,
                                position: 'relative', zIndex: 1,
                            }}>
                                <div style={{
                                    width: 52, height: 52, borderRadius: 14, marginBottom: 20,
                                    background: `rgba(${s.color === '#7c3aed' ? '124,58,237' : s.color === '#4f46e5' ? '79,70,229' : '14,165,233'},0.2)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                                    border: `1px solid rgba(${s.color === '#7c3aed' ? '124,58,237' : s.color === '#4f46e5' ? '79,70,229' : '14,165,233'},0.3)`,
                                }}>{s.icon}</div>
                                <h3 className="font-display" style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{s.title}</h3>
                                <p style={{ fontSize: 15, color: 'rgba(226,232,240,0.55)', lineHeight: 1.7 }}>{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   FEATURES
───────────────────────────────────────── */
function Features() {
    const features = [
        { icon: '🎙️', title: 'Whisper Transcription', desc: 'Industry-leading 95%+ accuracy. Speaker diarization included. 50+ languages supported.', tag: 'Core' },
        { icon: '🧠', title: 'Intent Detection', desc: 'Know exactly why every customer called — automatically classified and tagged.', tag: 'NLP' },
        { icon: '💬', title: 'Sentiment Analysis', desc: 'Positive, negative, neutral — per turn and aggregated across the full conversation.', tag: 'NLP' },
        { icon: '📊', title: 'QA Scoring', desc: 'Automated rubric-based scoring across communication, resolution, and professionalism.', tag: 'QA' },
        { icon: '🏆', title: 'Agent Evaluation', desc: 'Grade every agent objectively. Track performance trends and coach proactively.', tag: 'Insights' },
        { icon: '🔑', title: 'Keyword Intelligence', desc: 'Surface trending topics, competitor mentions, and product pain points automatically.', tag: 'Analytics' },
        { icon: '📝', title: 'AI Summaries', desc: 'One-paragraph summaries generated per call. Perfect for CRM notes and coaching.', tag: 'AI' },
        { icon: '📈', title: 'Business Intelligence', desc: 'Aggregate dashboards showing team trends, peak complaint periods, and CSAT predictors.', tag: 'BI' },
        { icon: '🔒', title: 'Enterprise Security', desc: 'SOC2-ready architecture. Data encrypted at rest and in transit. Your data stays yours.', tag: 'Security' },
    ];

    return (
        <section id="features" style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                <div style={{ textAlign: 'center', marginBottom: 80 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                        background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Features</span>
                    </div>
                    <h2 className="font-display" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                        The complete toolkit for<br />
                        <span className="gradient-text">conversation intelligence</span>
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 20 }}>
                    {features.map((f, i) => (
                        <div key={i} className="card-hover" style={{
                            padding: '28px 24px', borderRadius: 20,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            transition: 'all 0.3s ease',
                            position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, right: 0,
                                padding: '5px 12px', borderRadius: '0 20px 0 12px',
                                background: 'rgba(124,58,237,0.15)',
                                fontSize: 10, fontWeight: 700, color: '#a78bfa',
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                            }}>{f.tag}</div>
                            <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{f.title}</h3>
                            <p style={{ fontSize: 14, color: 'rgba(226,232,240,0.5)', lineHeight: 1.7 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   ANALYTICS SHOWCASE
───────────────────────────────────────── */
function AnalyticsShowcase() {
    return (
        <section style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                <div style={{ textAlign: 'center', marginBottom: 64 }}>
                    <h2 className="font-display" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                        Real-time analytics,<br />
                        <span className="gradient-text">zero manual work</span>
                    </h2>
                    <p style={{ fontSize: 17, color: 'rgba(226,232,240,0.5)', marginTop: 16 }}>
                        Everything your team needs, surfaced automatically
                    </p>
                </div>

                {/* Big dashboard preview */}
                <div className="gradient-border" style={{
                    borderRadius: 28, overflow: 'hidden',
                    background: 'rgba(8,8,18,0.9)', backdropFilter: 'blur(40px)',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
                }}>
                    {/* Top bar */}
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {['#ef4444', '#f59e0b', '#22c55e'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <div style={{ padding: '4px 20px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                                Convexa AI — Analytics Dashboard
                            </div>
                        </div>
                    </div>

                    {/* Dashboard content */}
                    <div style={{ padding: 32 }}>

                        {/* Stat row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
                            {[
                                { label: 'Total Calls', val: '2,847', color: '#7c3aed', delta: '+12%' },
                                { label: 'Avg QA Score', val: '87.4', color: '#4f46e5', delta: '+5.2' },
                                { label: 'Positive %', val: '73.1%', color: '#22c55e', delta: '+8.3%' },
                                { label: 'Unique Keywords', val: '412', color: '#0ea5e9', delta: '+34' },
                            ].map((s, i) => (
                                <div key={i} style={{
                                    padding: '18px 20px', borderRadius: 16,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
                                    <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{s.val}</div>
                                    <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, marginTop: 4 }}>{s.delta} this week</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

                            {/* Keyword bars */}
                            <div style={{ padding: '24px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Top Discussion Topics</div>
                                {[
                                    { kw: 'billing', pct: 88 },
                                    { kw: 'refund', pct: 74 },
                                    { kw: 'cancellation', pct: 61 },
                                    { kw: 'upgrade', pct: 53 },
                                    { kw: 'support', pct: 45 },
                                ].map((k, i) => (
                                    <div key={i} style={{ marginBottom: 14 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{k.kw}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>{k.pct}%</span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                                            <div style={{
                                                width: `${k.pct}%`, height: '100%', borderRadius: 3,
                                                background: `linear-gradient(90deg, #7c3aed, #4f46e5 60%, #0ea5e9)`,
                                                transition: 'width 1s ease',
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Sentiment donut mock */}
                            <div style={{ padding: '24px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Sentiment Split</div>

                                {/* SVG Donut */}
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                                    <svg width="140" height="140" viewBox="0 0 140 140">
                                        <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
                                        {/* Positive 68% */}
                                        <circle cx="70" cy="70" r="50" fill="none" stroke="#22c55e" strokeWidth="18"
                                            strokeDasharray={`${0.68 * 314} ${314}`} strokeDashoffset="78.5" strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }} />
                                        {/* Negative 18% */}
                                        <circle cx="70" cy="70" r="50" fill="none" stroke="#ef4444" strokeWidth="18"
                                            strokeDasharray={`${0.18 * 314} ${314}`} strokeDashoffset={`${-(0.68 * 314) + 78.5}`} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }} />
                                        <text x="70" y="68" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800" fontFamily="Syne, sans-serif">68%</text>
                                        <text x="70" y="85" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10">Positive</text>
                                    </svg>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[{ label: 'Positive', pct: '68%', color: '#22c55e' }, { label: 'Negative', pct: '18%', color: '#ef4444' }, { label: 'Neutral', pct: '14%', color: '#eab308' }].map((s, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{s.label}</span>
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.pct}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   WHY CONVEXA
───────────────────────────────────────── */
function WhyConvexa() {
    const advantages = [
        { icon: '⚡', title: 'Instant Analysis', desc: '10x faster than manual review. Analyze 100 calls in the time it takes a human to review one.' },
        { icon: '🎯', title: 'Unbiased QA', desc: 'Consistent scoring criteria applied to every call. No favoritism, no fatigue.' },
        { icon: '📡', title: 'Real-time Alerts', desc: 'Get notified instantly when a call scores below threshold or a critical keyword is detected.' },
        { icon: '🔗', title: 'Stack-Ready', desc: 'REST API for easy integration with Salesforce, HubSpot, Zendesk and your existing tech stack.' },
    ];

    return (
        <section style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

                    <div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                            background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                        }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Why Convexa AI</span>
                        </div>
                        <h2 className="font-display" style={{ fontSize: 'clamp(30px,3.5vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1, marginBottom: 24 }}>
                            Built for the way<br />
                            modern teams work.
                        </h2>
                        <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.55)', lineHeight: 1.8, marginBottom: 40 }}>
                            Convexa AI isn't another analytics tool that requires months of setup. It's a drop-in intelligence layer for your existing call workflows.
                        </p>

                        <Link to="/register" className="btn-glow" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '13px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                            color: '#fff', textDecoration: 'none',
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
                        }}>
                            Start Analyzing Calls →
                        </Link>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {advantages.map((a, i) => (
                            <div key={i} className="card-hover" style={{
                                display: 'flex', gap: 20, padding: '22px 24px', borderRadius: 18,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                alignItems: 'flex-start',
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                                    background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                                }}>{a.icon}</div>
                                <div>
                                    <div className="font-display" style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{a.title}</div>
                                    <div style={{ fontSize: 14, color: 'rgba(226,232,240,0.5)', lineHeight: 1.6 }}>{a.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   TESTIMONIALS
───────────────────────────────────────── */
function Testimonials() {
    const testi = [
        { quote: "We went from reviewing 3% of calls to 100% overnight. Our QA scores improved by 31% in the first month.", name: 'Sarah K.', role: 'VP of Customer Success, Nexora', avatar: '👩‍💼' },
        { quote: "The agent evaluation feature alone saved us 20 hours a week in manual scoring. Convexa AI is a game changer.", name: 'Marcus T.', role: 'Call Center Director, Veltrix', avatar: '👨‍💻' },
        { quote: "The keyword intelligence surfaced a product issue we'd been missing for 3 months. Caught and fixed in a week.", name: 'Priya R.', role: 'Head of CX, Lumora Health', avatar: '👩‍🔬' },
    ];

    return (
        <section style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>

                <div style={{ textAlign: 'center', marginBottom: 72 }}>
                    <h2 className="font-display" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                        Loved by teams that<br />
                        <span className="gradient-text-warm">can't go back.</span>
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24 }}>
                    {testi.map((t, i) => (
                        <div key={i} className="card-hover gradient-border" style={{
                            padding: '32px 28px', borderRadius: 24,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                        }}>
                            <div style={{ fontSize: 36, color: 'rgba(124,58,237,0.6)', marginBottom: 16 }}>"</div>
                            <p style={{ fontSize: 16, color: 'rgba(226,232,240,0.75)', lineHeight: 1.7, marginBottom: 28 }}>{t.quote}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%', fontSize: 22,
                                    background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{t.avatar}</div>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{t.name}</div>
                                    <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.4)' }}>{t.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   PRICING
───────────────────────────────────────── */
function Pricing() {
    const plans = [
        {
            name: 'Starter', price: '$49', period: '/mo', highlight: false,
            desc: 'Perfect for small support teams getting started.',
            features: ['200 calls / month', 'Transcription + Sentiment', 'QA Scoring', '3 Team Members', 'Email Support'],
        },
        {
            name: 'Pro', price: '$149', period: '/mo', highlight: true,
            desc: 'For growing teams that need full intelligence.',
            features: ['1,000 calls / month', 'All Starter features', 'Agent Evaluation', 'Keyword Intelligence', 'Business Insights', 'API Access', 'Priority Support'],
        },
        {
            name: 'Enterprise', price: 'Custom', period: '', highlight: false,
            desc: 'For large organizations with advanced needs.',
            features: ['Unlimited calls', 'All Pro features', 'Custom AI Models', 'SSO / SAML', 'Dedicated CSM', 'SLA Guarantee', 'On-premise option'],
        },
    ];

    return (
        <section id="pricing" style={{ padding: '120px 24px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>

                <div style={{ textAlign: 'center', marginBottom: 72 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                        background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                    }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pricing</span>
                    </div>
                    <h2 className="font-display" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1 }}>
                        Simple, transparent pricing
                    </h2>
                    <p style={{ fontSize: 17, color: 'rgba(226,232,240,0.5)', marginTop: 16 }}>Start free. Scale when you're ready.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
                    {plans.map((p, i) => (
                        <div key={i} className={p.highlight ? 'animate-pulse-glow' : ''} style={{
                            padding: '36px 28px', borderRadius: 24,
                            background: p.highlight
                                ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.2))'
                                : 'rgba(255,255,255,0.03)',
                            border: p.highlight
                                ? '1px solid rgba(124,58,237,0.5)'
                                : '1px solid rgba(255,255,255,0.07)',
                            position: 'relative', overflow: 'hidden',
                            transition: 'transform 0.3s ease',
                        }}>
                            {p.highlight && (
                                <div style={{
                                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                                    padding: '4px 20px', borderRadius: '0 0 12px 12px',
                                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                    fontSize: 11, fontWeight: 700, color: '#fff',
                                    letterSpacing: '0.06em', textTransform: 'uppercase',
                                }}>Most Popular</div>
                            )}
                            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'rgba(226,232,240,0.6)', marginBottom: 8, marginTop: p.highlight ? 16 : 0 }}>{p.name}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                                <span className="font-display" style={{ fontSize: 42, fontWeight: 800, color: '#fff' }}>{p.price}</span>
                                <span style={{ fontSize: 14, color: 'rgba(226,232,240,0.4)' }}>{p.period}</span>
                            </div>
                            <p style={{ fontSize: 14, color: 'rgba(226,232,240,0.5)', marginBottom: 28, lineHeight: 1.6 }}>{p.desc}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                                {p.features.map((f, fi) => (
                                    <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#a78bfa' }}>✓</div>
                                        <span style={{ fontSize: 14, color: 'rgba(226,232,240,0.7)' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to="/register" style={{
                                display: 'block', textAlign: 'center', padding: '12px 24px', borderRadius: 12,
                                fontWeight: 700, fontSize: 15, textDecoration: 'none',
                                color: p.highlight ? '#fff' : 'rgba(226,232,240,0.8)',
                                background: p.highlight
                                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                                    : 'rgba(255,255,255,0.06)',
                                border: p.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                boxShadow: p.highlight ? '0 8px 24px rgba(124,58,237,0.4)' : 'none',
                                transition: 'all 0.2s ease',
                            }}>
                                {p.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   CTA
───────────────────────────────────────── */
function CTA() {
    return (
        <section style={{ padding: '80px 24px 120px', position: 'relative', zIndex: 1 }} className="section-reveal">
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{
                    borderRadius: 32, padding: '80px 60px', textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(79,70,229,0.2) 50%, rgba(14,165,233,0.2) 100%)',
                    border: '1px solid rgba(124,58,237,0.3)',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Glow */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        width: 500, height: 300, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)',
                        filter: 'blur(60px)', pointerEvents: 'none',
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <img
                            src={logo}
                            alt="Convexa AI"
                            style={{
                                height: 90,
                                width: 'auto',
                                margin: '0 auto 24px',
                                display: 'block',
                                objectFit: 'contain'
                            }}
                        />
                        <h2 className="font-display" style={{ fontSize: 'clamp(30px,4vw,56px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 20, lineHeight: 1.1 }}>
                            Ready to decode<br />every conversation?
                        </h2>
                        <p style={{ fontSize: 18, color: 'rgba(226,232,240,0.65)', marginBottom: 40, lineHeight: 1.7 }}>
                            Join hundreds of teams turning call recordings into business intelligence.<br />
                            Free to start — no credit card required.
                        </p>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link to="/register" className="btn-glow" style={{
                                padding: '15px 32px', borderRadius: 14, fontSize: 17, fontWeight: 700,
                                color: '#fff', textDecoration: 'none',
                                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                boxShadow: '0 10px 40px rgba(124,58,237,0.5)',
                            }}>
                                Start Free Today
                            </Link>
                            <Link to="/login" style={{
                                padding: '15px 32px', borderRadius: 14, fontSize: 17, fontWeight: 600,
                                color: 'rgba(226,232,240,0.8)', textDecoration: 'none',
                                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                            }}>
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ─────────────────────────────────────────
   FOOTER
───────────────────────────────────────── */
function Footer() {
    return (
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 24px 32px', position: 'relative', zIndex: 1 }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>

                    {/* Brand */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    
                                }}
                            >
                                <img
                                    src={logo}
                                    alt="Convexa AI"
                                    style={{
                                        height: 50,
                                        width: 'auto',
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                            <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Convexa AI</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(226,232,240,0.4)', lineHeight: 1.7, maxWidth: 260 }}>
                            AI-powered conversation intelligence for modern customer support teams.
                        </p>
                        <div style={{ marginTop: 20, fontSize: 12, color: 'rgba(226,232,240,0.25)' }}>
                            Built with Spring Boot · FastAPI · Whisper · Ollama
                        </div>
                    </div>

                    {[
                        { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
                        { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
                        { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'GDPR'] },
                    ].map(col => (
                        <div key={col.title}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(226,232,240,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>{col.title}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {col.links.map(link => (
                                    <a key={link} href="#" style={{ fontSize: 14, color: 'rgba(226,232,240,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.target.style.color = '#fff'}
                                        onMouseLeave={e => e.target.style.color = 'rgba(226,232,240,0.5)'}
                                    >{link}</a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.3)' }}>© 2026 Convexa AI. All rights reserved.</p>
                    <p style={{ fontSize: 13, color: 'rgba(226,232,240,0.3)' }}>Made for the world's best support teams.</p>
                </div>
            </div>
        </footer>
    );
}

/* ─────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────── */
export default function LandingPage() {
    useReveal();

    return (
        <>
            <style>{globalStyles}</style>
            <div style={{ background: '#05050a', minHeight: '100vh', position: 'relative' }}>
                <BgOrbs />
                <Navbar />
                <Hero />
                <TrustedBy />
                <Problem />
                <HowItWorks />
                <Features />
                <AnalyticsShowcase />
                <WhyConvexa />
                <Testimonials />
                <Pricing />
                <CTA />
                <Footer />
            </div>
        </>
    );
}
