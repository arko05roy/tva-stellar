"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import Link from "next/link";

// ============================================
// MINIMAL SACRED TIMELINE - CSS ONLY
// Clean, elegant, not AI-generated looking
// ============================================

function SacredTimelineCSS() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Single golden line - the sacred timeline */}
      <div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFC800] to-transparent"
        style={{ top: '62%' }}
      />

      {/* Subtle glow beneath */}
      <div
        className="absolute left-0 right-0 h-[60px] bg-gradient-to-r from-transparent via-[#FFC800]/10 to-transparent blur-xl"
        style={{ top: 'calc(62% - 30px)' }}
      />

      {/* Traveling pulse */}
      {mounted && (
        <motion.div
          className="absolute h-[2px] w-32 bg-gradient-to-r from-transparent via-white to-transparent"
          style={{ top: '62%' }}
          animate={{
            x: ['-10vw', '110vw'],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
            repeatDelay: 2
          }}
        />
      )}

      {/* Small accent dots along the line */}
      {[15, 35, 55, 75, 90].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[#FFC800]"
          style={{ top: 'calc(62% - 1px)', left: `${pos}%` }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1]
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.4
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// UI COMPONENTS
// ============================================

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] } },
};

function GlitchText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute top-0 left-0 z-0 text-[#FFC800]/20 animate-pulse"
        style={{ clipPath: "inset(0 0 50% 0)" }}
        aria-hidden
      >
        {children}
      </span>
    </span>
  );
}

function MagneticButton({
  children,
  href,
  variant = "primary",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPosition({ x: x * 0.12, y: y * 0.12 });
  };

  const handleMouseLeave = () => setPosition({ x: 0, y: 0 });

  const baseStyles =
    "relative px-8 py-4 rounded-lg font-semibold text-lg overflow-hidden transition-all duration-300 inline-flex items-center gap-3";
  const variants = {
    primary:
      "bg-[#FFC800] text-black hover:shadow-[0_0_50px_rgba(255,200,0,0.4)] hover:scale-[1.02]",
    secondary:
      "border border-white/20 text-white/80 hover:border-[#FFC800]/60 hover:text-[#FFC800] hover:bg-[#FFC800]/5",
  };

  return (
    <motion.a
      ref={buttonRef}
      href={href}
      className={`${baseStyles} ${variants[variant]}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {children}
      {variant === "primary" && (
        <motion.span
          animate={{ x: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          →
        </motion.span>
      )}
    </motion.a>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-4 transition-all duration-500 ${
        scrolled ? "bg-black/90 backdrop-blur-xl border-b border-[#FFC800]/10" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-lg bg-[#FFC800] flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(255,200,0,0.5)] transition-shadow">
            <span className="text-black font-black text-xl font-mono">T</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-semibold text-lg text-white">TVA</span>
            <span className="text-[10px] text-[#FFC800]/60 font-mono block -mt-1">
              TIME VARIANCE AUTHORITY
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {["How it works", "Architecture", "Docs"].map((item, i) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
              className="text-sm text-white/50 hover:text-[#FFC800] transition-colors font-medium tracking-wide uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              {item}
            </motion.a>
          ))}
        </div>

        <Link
          href="/explorer"
          className="px-4 py-2 text-sm font-semibold bg-[#FFC800]/10 border border-[#FFC800]/30 text-[#FFC800] rounded-lg hover:bg-[#FFC800] hover:text-black transition-all duration-300"
        >
          Explorer
        </Link>
      </div>
    </motion.nav>
  );
}

function Hero() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 500], [1, 0]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      {/* Subtle radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_65%,_rgba(255,200,0,0.06)_0%,_transparent_70%)]" />

      {/* Clean sacred timeline */}
      <SacredTimelineCSS />

      {/* Content */}
      <motion.div
        style={{ opacity }}
        className="relative z-20 min-h-screen flex flex-col justify-center px-6 md:px-10"
      >
        <div className="max-w-7xl mx-auto w-full">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-4xl">
            {/* Greek decorative text */}
            

            {/* Main headline - Greek mythology inspired */}
            <motion.h1
              variants={fadeUp}
              className="font-mythos text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] leading-[1.05] tracking-[0.04em] mb-10"
            >
              <span className="text-white/90">Deploy on the</span>
              <br />
              <span className="text-[#FFC800]">EVM.</span>
              <br />
              <span className="text-white/40">Settle on Stellar.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p variants={fadeUp} className="text-lg md:text-xl text-white/50 max-w-xl mb-6 leading-relaxed">
              TVA is a parallel execution environment for Solidity contracts.
              Your code runs in a variant timeline—we settle every transaction onto{" "}
              <span className="text-[#FFC800]">Stellar&apos;s sacred timeline</span>.
            </motion.p>

            {/* Tagline - Greek */}
            <motion.p variants={fadeUp} className="font-mythos text-sm text-white/25 mb-14 tracking-[0.3em]">
            
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-5">
              <MagneticButton href="/playground" variant="primary">
                Enter the Timeline
              </MagneticButton>
              <MagneticButton href="#how-it-works" variant="secondary">
                How it works
              </MagneticButton>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-20 lg:mt-28"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-4xl">
              {[
                { value: "5s", label: "Settlement", sub: "Sacred timeline finality" },
                { value: "$0.00001", label: "Per variant", sub: "Fixed. Not gas-dependent." },
                { value: "Zero", label: "MEV", sub: "No frontrunning. Ever." },
                { value: "Zero", label: "Bridges", sub: "Compile, don't bridge." },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                  className="group"
                >
                  <div className="text-2xl md:text-3xl font-bold font-mono text-[#FFC800] group-hover:text-white transition-colors">
                    {stat.value}
                  </div>
                  <div className="text-sm text-white/50 font-medium mt-1">{stat.label}</div>
                  <div className="text-xs text-white/25 mt-0.5">{stat.sub}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">
            Scroll
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-[#FFC800]/50 to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function KeyInsight() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-32 px-6 md:px-10 bg-black relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FFC800]/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <p className="text-xs font-mono text-[#FFC800]/60 uppercase tracking-widest mb-4">
            The Insight
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
            Others emulate.
            <br />
            <span className="text-[#FFC800]">We compile.</span>
          </h2>
          <p className="text-lg text-white/40 max-w-xl mx-auto">
            EVM interpreters add 10,000+ lines of on-chain code to your trust model.
            TVA compiles Solidity to Soroban WASM. Zero interpreter. Native speed.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Emulation */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white/50">Emulation</h3>
              <span className="text-xs font-mono text-red-400/60 px-2 py-1 rounded bg-red-500/10">
                OTHERS
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap font-mono text-sm mb-6">
              <span className="px-3 py-1.5 rounded bg-[#9B7FFF]/10 text-[#9B7FFF]">.sol</span>
              <span className="text-white/20">→</span>
              <span className="px-3 py-1.5 rounded bg-white/5 text-white/40">solc</span>
              <span className="text-white/20">→</span>
              <span className="px-3 py-1.5 rounded bg-white/5 text-white/40">bytecode</span>
              <span className="text-white/20">→</span>
              <span className="px-3 py-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                interpreter
              </span>
            </div>
            <p className="text-sm text-white/30">
              10,000+ lines of on-chain interpreter. Every opcode reimplemented. Every bug inherited.
            </p>
          </motion.div>

          {/* Compilation */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="p-8 rounded-2xl border border-[#FFC800]/20 bg-[#FFC800]/[0.02] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFC800]/10 rounded-full blur-[40px]" />
            <div className="flex items-center justify-between mb-6 relative">
              <h3 className="text-lg font-semibold text-white">Compilation</h3>
              <span className="text-xs font-mono text-[#FFC800] px-2 py-1 rounded bg-[#FFC800]/10">
                TVA
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap font-mono text-sm mb-6 relative">
              <span className="px-3 py-1.5 rounded bg-[#9B7FFF]/10 text-[#9B7FFF]">.sol</span>
              <span className="text-[#FFC800]/40">→</span>
              <span className="px-3 py-1.5 rounded bg-[#FFC800]/10 text-[#FFC800]">TVA</span>
              <span className="text-[#FFC800]/40">→</span>
              <span className="px-3 py-1.5 rounded bg-[#FFC800]/10 text-[#FFC800]">.wasm</span>
              <span className="text-[#FFC800]/40">→</span>
              <span className="px-3 py-1.5 rounded bg-green-500/10 text-green-400">native</span>
            </div>
            <p className="text-sm text-white/50 relative">
              <span className="text-[#FFC800]">Zero</span> interpreter. Compiler runs off-chain. Your
              WASM executes at native speed.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-white/[0.02] border border-white/[0.05] font-mono text-sm">
            <span className="text-white/30">TCB =</span>
            <span className="text-white/60">Stellar</span>
            <span className="text-white/20">+</span>
            <span className="text-[#FFC800]">TVA</span>
            <span className="text-white/20 hidden sm:inline">// no bridges, no sequencers</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    {
      num: "01",
      title: "Write Solidity",
      desc: "Same tools. Same workflow. Hardhat, Foundry, ethers.js—unchanged.",
      code: `pragma solidity ^0.8.0;

contract Token {
    mapping(address => uint256) balances;

    function transfer(address to, uint256 amt) public {
        require(balances[msg.sender] >= amt);
        balances[msg.sender] -= amt;
        balances[to] += amt;
    }
}`,
      accent: "#9B7FFF",
    },
    {
      num: "02",
      title: "Compile to WASM",
      desc: "TVA compiles to Soroban WebAssembly. No bytecode interpretation.",
      code: `$ tva compile Token.sol

Compiling Token.sol...
  ✓ Type checking complete
  ✓ Generated Soroban WASM

Output:
  → Token.wasm     3.8 KB
  → Token.json     ABI`,
      accent: "#FFC800",
    },
    {
      num: "03",
      title: "Settle on Stellar",
      desc: "Every transaction settles via SCP. 5s deterministic finality.",
      code: `$ tva deploy Token --network stellar

Deploying...
  Contract: CDLZ...K4WE

  ✓ Settled in 4.8s
  ✓ Fee: $0.000001
  ✓ Finality: DETERMINISTIC

// No rollbacks. It's done.`,
      accent: "#22c55e",
    },
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-32 px-6 md:px-10 bg-[#030303]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-20"
        >
          <p className="text-xs font-mono text-[#FFC800]/60 uppercase tracking-widest mb-4">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
            Three commands.
            <br />
            <span className="text-white/40">Zero new concepts.</span>
          </h2>
        </motion.div>

        <div className="space-y-16">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="grid lg:grid-cols-2 gap-8 items-start"
            >
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-4 mb-4">
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-sm"
                    style={{ backgroundColor: `${step.accent}15`, color: step.accent }}
                  >
                    {step.num}
                  </span>
                  <h3 className="text-xl md:text-2xl font-bold text-white">{step.title}</h3>
                </div>
                <p className="text-white/40 text-lg">{step.desc}</p>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    </div>
                  </div>
                  <pre className="p-5 text-sm font-mono overflow-x-auto">
                    <code className="text-white/50">{step.code}</code>
                  </pre>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const data = [
    { prop: "Finality", eth: "~12 min", l2: "7 days*", tva: "5 seconds" },
    { prop: "Cost", eth: "$0.50-$50", l2: "$0.01-$0.10", tva: "~$0.00001" },
    { prop: "MEV", eth: "High", l2: "Medium", tva: "None" },
    { prop: "Bridge Risk", eth: "N/A", l2: "Required", tva: "None" },
  ];

  return (
    <section id="architecture" ref={ref} className="py-32 px-6 md:px-10 bg-black">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-16"
        >
          <p className="text-xs font-mono text-[#FFC800]/60 uppercase tracking-widest mb-4">
            Comparison
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Not an L2.
            <br />
            <span className="text-white/40">A different timeline.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/[0.06] overflow-hidden"
        >
          <div className="grid grid-cols-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="p-4 md:p-5 text-xs font-mono text-white/30 uppercase">&nbsp;</div>
            <div className="p-4 md:p-5 text-xs font-mono text-white/30 uppercase text-center">ETH</div>
            <div className="p-4 md:p-5 text-xs font-mono text-white/30 uppercase text-center">L2s</div>
            <div className="p-4 md:p-5 text-xs font-mono text-[#FFC800] uppercase text-center bg-[#FFC800]/5">
              TVA
            </div>
          </div>
          {data.map((row) => (
            <div key={row.prop} className="grid grid-cols-4 border-b border-white/[0.04] last:border-0">
              <div className="p-4 md:p-5 text-sm text-white/60">{row.prop}</div>
              <div className="p-4 md:p-5 text-sm text-white/30 text-center font-mono">{row.eth}</div>
              <div className="p-4 md:p-5 text-sm text-white/30 text-center font-mono">{row.l2}</div>
              <div className="p-4 md:p-5 text-sm text-[#FFC800] text-center font-mono font-semibold bg-[#FFC800]/5">
                {row.tva}
              </div>
            </div>
          ))}
        </motion.div>
        <p className="text-xs text-white/20 mt-4 font-mono">
          * "Soft finality" on L2s is marketing. Real finality = 7-day challenge window.
        </p>
      </div>
    </section>
  );
}

function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-32 px-6 md:px-10 bg-black relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-[#FFC800]/[0.06] rounded-full blur-[150px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-[#9B7FFF]/[0.04] rounded-full blur-[150px] -translate-y-1/2" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        className="max-w-3xl mx-auto text-center relative z-10"
      >
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
          Enter the timeline.
        </h2>
        <p className="text-lg text-white/40 mb-3">
          Your Solidity. Stellar&apos;s finality. No new language. No bridging.
        </p>
        <p className="text-sm text-white/20 font-mono mb-10">For all time. Always.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <MagneticButton href="/explorer" variant="primary">
            Launch Explorer
          </MagneticButton>
          <MagneticButton href="https://github.com/tva-protocol" variant="secondary">
            GitHub
          </MagneticButton>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 md:px-10 border-t border-white/[0.04] bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#FFC800] flex items-center justify-center">
              <span className="text-black font-black font-mono">T</span>
            </div>
            <div>
              <span className="font-semibold text-white">TVA Protocol</span>
              <p className="text-[10px] text-white/30 font-mono">TIME VARIANCE AUTHORITY</p>
            </div>
          </div>
          <div className="flex gap-6">
            {["Docs", "GitHub", "Discord", "Twitter"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-white/30 hover:text-[#FFC800] transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/[0.04] text-xs text-white/20 font-mono">
          For all time. Always.
        </div>
      </div>
    </footer>
  );
}

// ============================================
// MAIN
// ============================================

export default function Home() {
  return (
    <div className="relative min-h-screen bg-black">
      <Hero />
      <KeyInsight />
      <HowItWorks />
      <Comparison />
      <CTA />
      <Footer />
    </div>
  );
}
