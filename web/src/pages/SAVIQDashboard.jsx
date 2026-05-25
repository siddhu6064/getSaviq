/**
 * SAVIQDashboard.jsx
 * Self-contained dashboard preview with mock data.
 * 3D: Framer Motion tilt+shine on cards, R3F floating orbs in header.
 * Deps: framer-motion, recharts, lucide-react, three, @react-three/fiber, @react-three/drei
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring, useMotionTemplate } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float } from "@react-three/drei";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  CreditCard,
  PieChart,
  Target,
  Settings,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingBag,
  Coffee,
  Car,
  Home,
  Zap,
  Film,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  DollarSign,
  Activity,
  Award,
  Gauge,
  Tag,
  Sparkles,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  page: "#F9F8F6",
  surface: "#FFFFFF",
  surfaceHover: "#F2EFEB",
  primary: "#2B2A28",
  secondary: "#73716D",
  brand: "#4A6D5C",
  brandHover: "#3D594B",
  accent: "#E07A5F",
  income: "#3D8B61",
  incomeBg: "#E9F5EF",
  expense: "#E63946",
  expenseBg: "#FBEAEC",
  transfer: "#457B9D",
  warning: "#F4A261",
  border: "#E5E2DC",
  purple: "#8B5CF6",
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const SPENDING_TREND = [
  { month: "Nov", amount: 3200 },
  { month: "Dec", amount: 4100 },
  { month: "Jan", amount: 2800 },
  { month: "Feb", amount: 3600 },
  { month: "Mar", amount: 3100 },
  { month: "Apr", amount: 2650 },
  { month: "May", amount: 2340 },
];

const SUMMARY_CARDS = [
  {
    id: "balance",
    label: "Net Balance",
    value: 12480,
    prefix: "$",
    Icon: Wallet,
    color: C.brand,
    badge: "+8.2%",
    up: true,
  },
  {
    id: "income",
    label: "Total Income",
    value: 5350,
    prefix: "$",
    Icon: TrendingUp,
    color: C.income,
    badge: "+$850 bonus",
    up: true,
  },
  {
    id: "expenses",
    label: "Expenses",
    value: 2340,
    prefix: "$",
    Icon: TrendingDown,
    color: C.expense,
    badge: "↓12% vs last",
    up: false,
  },
];

const SMART_METRICS = [
  {
    id: "savings-score",
    label: "Savings Score",
    value: 78,
    suffix: "/100",
    Icon: Award,
    color: C.brand,
  },
  {
    id: "spend-velocity",
    label: "Spend Velocity",
    value: 2340,
    prefix: "$",
    suffix: "/mo",
    Icon: Gauge,
    color: C.accent,
  },
  {
    id: "financial-health",
    label: "Financial Health",
    value: 85,
    suffix: "%",
    Icon: Activity,
    color: C.income,
  },
  {
    id: "budget-conf",
    label: "Budget Confidence",
    value: 91,
    suffix: "%",
    Icon: Target,
    color: C.transfer,
  },
  {
    id: "top-category",
    label: "Top Category",
    value: "Housing",
    isText: true,
    Icon: Tag,
    color: C.warning,
    sub: "$1,850 · 42% of spend",
  },
  {
    id: "proj-savings",
    label: "Projected Savings",
    value: 1240,
    prefix: "$",
    Icon: Sparkles,
    color: C.purple,
    trend: "By end of month",
  },
];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", Icon: CreditCard },
  { id: "analytics", label: "Analytics", Icon: PieChart },
  { id: "goals", label: "Goals", Icon: Target },
  { id: "settings", label: "Settings", Icon: Settings },
];

const RECENT_TRANSACTIONS = [
  {
    id: 1,
    merchant: "Whole Foods Market",
    category: "Groceries",
    amount: -84.32,
    date: "Today",
    type: "expense",
    Icon: ShoppingBag,
  },
  {
    id: 2,
    merchant: "Salary Deposit",
    category: "Income",
    amount: 4500.0,
    date: "May 20",
    type: "income",
    Icon: DollarSign,
  },
  {
    id: 3,
    merchant: "Netflix",
    category: "Entertainment",
    amount: -15.99,
    date: "May 19",
    type: "expense",
    Icon: Film,
  },
  {
    id: 4,
    merchant: "Shell Gas Station",
    category: "Transport",
    amount: -52.4,
    date: "May 18",
    type: "expense",
    Icon: Car,
  },
  {
    id: 5,
    merchant: "Starbucks",
    category: "Dining Out",
    amount: -6.75,
    date: "May 18",
    type: "expense",
    Icon: Coffee,
  },
  {
    id: 6,
    merchant: "Freelance — Design",
    category: "Income",
    amount: 850.0,
    date: "May 17",
    type: "income",
    Icon: DollarSign,
  },
  {
    id: 7,
    merchant: "Electricity Bill",
    category: "Utilities",
    amount: -98.2,
    date: "May 15",
    type: "expense",
    Icon: Zap,
  },
  {
    id: 8,
    merchant: "Rent — May",
    category: "Housing",
    amount: -1850.0,
    date: "May 1",
    type: "expense",
    Icon: Home,
  },
];

const BUDGET_BARS = [
  { label: "Budget Used", pct: 68, color: C.brand },
  { label: "Savings Rate", pct: 24, color: C.purple },
  { label: "Income vs Expenses", pct: 56, color: C.income },
];

const CATEGORY_BREAKDOWN = [
  { cat: "Housing", pct: 42, color: C.warning },
  { cat: "Food", pct: 18, color: C.accent },
  { cat: "Transport", pct: 14, color: C.transfer },
  { cat: "Other", pct: 26, color: C.secondary },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1300, trigger = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger || typeof target !== "number") return;
    let startTs = null;
    const step = (ts) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, trigger]);
  return val;
}

// Mouse-tracked 3D tilt with specular shine
function useTilt(strength = 10) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const cfg = { stiffness: 280, damping: 28, mass: 0.4 };
  const x = useSpring(rawX, cfg);
  const y = useSpring(rawY, cfg);

  const rotateX = useTransform(y, [-0.5, 0.5], [strength, -strength]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-strength, strength]);
  const shineX = useTransform(x, [-0.5, 0.5], [15, 85]);
  const shineY = useTransform(y, [-0.5, 0.5], [15, 85]);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.14) 0%, transparent 60%)`;

  const onMouseMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set((e.clientX - r.left) / r.width - 0.5);
    rawY.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return { rotateX, rotateY, shine, onMouseMove, onMouseLeave };
}

// 3D tilt wrapper — applies perspective + specular shine to any card
function Tilt3D({ children, strength = 10, className = "", style = {} }) {
  const { rotateX, rotateY, shine, onMouseMove, onMouseLeave } = useTilt(strength);
  return (
    <motion.div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
        transformStyle: "preserve-3d",
        ...style,
      }}
      className={`relative ${className}`}
    >
      {children}
      {/* Specular highlight follows cursor */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-card"
        style={{ background: shine }}
      />
    </motion.div>
  );
}

// ─── R3F: Floating orbs (hero header element) ─────────────────────────────────
function Orb({ position, color, speed = 1, distort = 0.4, radius = 0.55 }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed;
    ref.current.rotation.x = Math.sin(t * 0.4) * 0.3;
    ref.current.rotation.y = Math.sin(t * 0.3) * 0.5;
  });
  return (
    <Float speed={speed * 1.2} rotationIntensity={0.4} floatIntensity={0.8}>
      <Sphere ref={ref} args={[radius, 48, 48]} position={position}>
        <MeshDistortMaterial
          color={color}
          distort={distort}
          speed={1.8}
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.82}
        />
      </Sphere>
    </Float>
  );
}

function FloatingOrbs() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      style={{ background: "transparent" }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-5, -3, 2]} intensity={0.7} color={C.accent} />
      <pointLight position={[3, -4, 1]} intensity={0.5} color={C.purple} />

      <Orb position={[-1.6, 0.4, 0]} color={C.brand} speed={0.7} distort={0.35} radius={0.62} />
      <Orb position={[1.5, 0.2, -0.5]} color={C.purple} speed={0.9} distort={0.45} radius={0.48} />
      <Orb position={[0, -0.5, 0.5]} color={C.accent} speed={1.1} distort={0.3} radius={0.38} />
    </Canvas>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ activeNav, onNav, open, onClose }) {
  const content = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-[#E5E2DC] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: C.brand }}
          >
            <Wallet size={16} color="#fff" />
          </div>
          <span
            className="text-xl font-bold font-heading tracking-tight"
            style={{ color: C.primary }}
          >
            SAVIQ
          </span>
        </div>
        <button className="lg:hidden p-1 rounded-lg hover:bg-[#F2EFEB]" onClick={onClose}>
          <X size={18} color={C.secondary} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => {
                onNav(item.id);
                onClose();
              }}
              whileHover={{ x: isActive ? 0 : 2 }}
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? `${C.brand}15` : "transparent",
                color: isActive ? C.brand : C.secondary,
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                  style={{ backgroundColor: C.brand }}
                />
              )}
              <item.Icon size={17} />
              <span className="font-body">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-[#E5E2DC]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer transition-colors hover:bg-[#F2EFEB]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
            style={{ backgroundColor: C.brand }}
          >
            SY
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold font-body truncate" style={{ color: C.primary }}>
              Sid Y.
            </p>
            <p className="text-xs font-body truncate" style={{ color: C.secondary }}>
              Premium Plan
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 top-0 bottom-0 z-20 border-r border-[#E5E2DC]"
        style={{ backgroundColor: C.surface }}
      >
        {content}
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: -240 }}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-50 w-60 flex flex-col border-r border-[#E5E2DC]"
            style={{ backgroundColor: C.surface }}
          >
            {content}
          </motion.aside>
        </div>
      )}
    </>
  );
}

// ─── Add Transaction Button ───────────────────────────────────────────────────
function AddTransactionButton({ onClick }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.span
        animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: C.brand }}
      />
      <motion.span
        animate={{ scale: [1, 2.1], opacity: [0.2, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut", delay: 0.35 }}
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: C.brand }}
      />
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94, rotateX: 12 }}
        onClick={onClick}
        className="relative flex items-center gap-2 text-white text-sm font-semibold font-body px-5 py-2.5 rounded-full shadow-lg transition-colors"
        style={{ backgroundColor: C.brand, transformPerspective: 600 }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.brandHover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = C.brand)}
      >
        <Plus size={17} />
        Add Transaction
      </motion.button>
    </div>
  );
}

// ─── Summary Card (3D tilt) ───────────────────────────────────────────────────
function SummaryCard({ card, index, started }) {
  const counted = useCountUp(card.value, 1200, started);
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.45, ease: "easeOut" }}
    >
      <Tilt3D
        strength={9}
        className="overflow-hidden rounded-card border border-[#E5E2DC] cursor-pointer"
        style={{ backgroundColor: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        {/* Left accent bar — lifted in Z */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-card"
          style={{ backgroundColor: card.color, transform: "translateZ(8px)" }}
        />
        {/* Background gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top left, ${card.color}12 0%, transparent 55%)`,
          }}
        />

        <div className="relative px-5 py-5 pl-6" style={{ transform: "translateZ(6px)" }}>
          <div className="flex items-center justify-between mb-4">
            {/* Floating icon */}
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 3 + index * 0.4, ease: "easeInOut" }}
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${card.color}18` }}
            >
              <card.Icon size={20} style={{ color: card.color }} />
            </motion.div>
            <span
              className="flex items-center gap-1 text-xs font-semibold font-body px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${card.color}15`, color: card.color }}
            >
              {card.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {card.badge}
            </span>
          </div>
          <p className="text-sm font-medium font-body mb-1" style={{ color: C.secondary }}>
            {card.label}
          </p>
          <p className="text-3xl font-bold font-heading leading-none" style={{ color: C.primary }}>
            {card.prefix}
            {counted.toLocaleString()}
          </p>
        </div>
      </Tilt3D>
    </motion.div>
  );
}

// ─── Spending Chart ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-[#E5E2DC] px-3 py-2.5 shadow-lg"
      style={{ backgroundColor: C.surface }}
    >
      <p className="text-xs font-body" style={{ color: C.secondary }}>
        {label}
      </p>
      <p className="text-base font-bold font-heading" style={{ color: C.primary }}>
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  );
};

function SpendingChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="rounded-card border border-[#E5E2DC] overflow-hidden"
      style={{ backgroundColor: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
    >
      <div className="px-5 py-4 border-b border-[#E5E2DC] flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-heading" style={{ color: C.primary }}>
            Spending Trend
          </h3>
          <p className="text-xs font-body mt-0.5" style={{ color: C.secondary }}>
            Last 7 months
          </p>
        </div>
        <span
          className="text-xs font-semibold font-body px-2.5 py-1 rounded-full"
          style={{ backgroundColor: C.incomeBg, color: C.income }}
        >
          ↓ 12% overall
        </span>
      </div>
      <div className="px-4 py-5" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={SPENDING_TREND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.brand} stopOpacity={0.22} />
                <stop offset="95%" stopColor={C.brand} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fontFamily: "Inter, sans-serif", fill: C.secondary }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fontFamily: "Inter, sans-serif", fill: C.secondary }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.border, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke={C.brand}
              strokeWidth={2.5}
              fill="url(#spendGrad)"
              dot={{ fill: C.brand, strokeWidth: 0, r: 3.5 }}
              activeDot={{ fill: C.brand, stroke: "#fff", strokeWidth: 2.5, r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ─── Monthly Stats Card ───────────────────────────────────────────────────────
function MonthlyStatsCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.45 }}
      className="rounded-card border border-[#E5E2DC] overflow-hidden"
      style={{ backgroundColor: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
    >
      <div className="px-5 py-4 border-b border-[#E5E2DC]">
        <h3 className="text-base font-bold font-heading" style={{ color: C.primary }}>
          This Month
        </h3>
      </div>
      <div className="p-5 space-y-4">
        {BUDGET_BARS.map((item, i) => (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium font-body" style={{ color: C.secondary }}>
                {item.label}
              </span>
              <span className="text-xs font-bold font-heading" style={{ color: item.color }}>
                {item.pct}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: C.surfaceHover }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.pct}%` }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
        <div className="pt-3 border-t border-[#E5E2DC]">
          <p className="text-xs font-semibold font-body mb-3" style={{ color: C.secondary }}>
            Category Split
          </p>
          {CATEGORY_BREAKDOWN.map((b) => (
            <div key={b.cat} className="flex items-center gap-2 mb-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: b.color }}
              />
              <span className="text-xs font-body flex-1" style={{ color: C.primary }}>
                {b.cat}
              </span>
              <span className="text-xs font-semibold font-body" style={{ color: b.color }}>
                {b.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Metric Card (3D tilt + floating icon) ────────────────────────────────────
function MetricCard({ metric, index, started }) {
  const counted = useCountUp(metric.isText ? 0 : metric.value, 1400, started);
  const display = metric.isText
    ? metric.value
    : `${metric.prefix ?? ""}${counted.toLocaleString()}${metric.suffix ?? ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 + index * 0.07, duration: 0.4, ease: "easeOut" }}
    >
      <Tilt3D
        strength={12}
        className="overflow-hidden rounded-card border border-[#E5E2DC] cursor-pointer"
        style={{ backgroundColor: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
      >
        {/* Accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-card"
          style={{ backgroundColor: metric.color, transform: "translateZ(8px)" }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top left, ${metric.color}20 0%, transparent 58%)`,
          }}
        />

        <div className="relative p-5 pl-6" style={{ transform: "translateZ(6px)" }}>
          <div className="mb-3">
            {/* Floating icon animation */}
            <motion.div
              animate={{ y: [0, -4, 0], rotate: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 3.5 + index * 0.3, ease: "easeInOut" }}
              className="inline-flex p-2 rounded-lg"
              style={{ backgroundColor: `${metric.color}18` }}
            >
              <metric.Icon size={16} style={{ color: metric.color }} />
            </motion.div>
          </div>

          <p
            className="text-[11px] font-bold font-body uppercase tracking-widest mb-1"
            style={{ color: C.secondary }}
          >
            {metric.label}
          </p>
          <p
            className="text-2xl font-bold font-heading leading-none mb-1"
            style={{ color: C.primary }}
          >
            {display}
          </p>
          {metric.sub && (
            <p className="text-xs font-body mt-1" style={{ color: C.secondary }}>
              {metric.sub}
            </p>
          )}
          {metric.trend && (
            <p className="text-xs font-semibold font-body mt-2" style={{ color: metric.color }}>
              {metric.trend}
            </p>
          )}
        </div>
      </Tilt3D>
    </motion.div>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
function TransactionRow({ tx, index }) {
  const isIncome = tx.type === "income";
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.045, duration: 0.3 }}
      whileHover={{ backgroundColor: C.page }}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E5E2DC] last:border-0 cursor-pointer transition-colors"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: isIncome ? C.incomeBg : "#FEF3EE" }}
      >
        <tx.Icon size={16} style={{ color: isIncome ? C.income : C.accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-body truncate" style={{ color: C.primary }}>
          {tx.merchant}
        </p>
        <p className="text-xs font-body" style={{ color: C.secondary }}>
          {tx.category} · {tx.date}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p
          className="text-sm font-bold font-heading"
          style={{ color: isIncome ? C.income : C.expense }}
        >
          {isIncome ? "+" : "−"}${Math.abs(tx.amount).toFixed(2)}
        </p>
        <span
          className="inline-block text-[10px] font-semibold font-body px-1.5 py-0.5 rounded-full mt-0.5"
          style={{
            backgroundColor: isIncome ? C.incomeBg : C.expenseBg,
            color: isIncome ? C.income : C.expense,
          }}
        >
          {isIncome ? "Income" : "Expense"}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function SAVIQDashboard() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen font-body" style={{ backgroundColor: C.page }}>
      <Sidebar
        activeNav={activeNav}
        onNav={setActiveNav}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="lg:ml-60 min-h-screen flex flex-col">
        {/* ── Hero header with R3F orbs ── */}
        <div
          className="relative overflow-hidden border-b border-[#E5E2DC]"
          style={{ backgroundColor: C.brand, minHeight: 180 }}
        >
          {/* R3F canvas — fills header */}
          <div className="absolute inset-0 pointer-events-none">
            <FloatingOrbs />
          </div>

          {/* Frosted content layer */}
          <div className="relative z-10 px-5 lg:px-8 py-5 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="text-2xl font-bold font-heading text-white"
                >
                  Good morning, Sid 👋
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-sm font-body text-white/70 mt-0.5 hidden sm:block"
                >
                  May 24, 2026 · Your financial snapshot
                </motion.p>

                {/* Big balance callout */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-4 flex items-baseline gap-2"
                >
                  <span className="text-4xl font-bold font-heading text-white">$12,480</span>
                  <span className="text-sm font-body text-white/60">net balance</span>
                  <span className="text-xs font-semibold font-body px-2 py-0.5 rounded-full bg-white/20 text-white">
                    ↑ 8.2%
                  </span>
                </motion.div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                className="relative p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Bell size={20} />
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-[#4A6D5C]"
                  style={{ backgroundColor: C.accent }}
                />
              </motion.button>
              <AddTransactionButton onClick={() => {}} />
            </div>
          </div>
        </div>

        {/* ── Page content ── */}
        <div className="flex-1 px-5 lg:px-8 py-6 space-y-6 max-w-[1400px] w-full mx-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUMMARY_CARDS.map((card, i) => (
              <SummaryCard key={card.id} card={card} index={i} started={started} />
            ))}
          </div>

          {/* Chart + Monthly stats */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <SpendingChart />
            </div>
            <div>
              <MonthlyStatsCard />
            </div>
          </div>

          {/* Smart metrics */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold font-heading" style={{ color: C.primary }}>
                Smart Metrics
              </h2>
              <button
                className="flex items-center gap-0.5 text-xs font-semibold font-body hover:opacity-70 transition-opacity"
                style={{ color: C.brand }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SMART_METRICS.map((metric, i) => (
                <MetricCard key={metric.id} metric={metric} index={i} started={started} />
              ))}
            </div>
          </section>

          {/* Recent transactions */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <div
              className="rounded-card border border-[#E5E2DC] overflow-hidden"
              style={{ backgroundColor: C.surface, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            >
              <div className="px-5 py-4 border-b border-[#E5E2DC] flex items-center justify-between">
                <h3 className="text-base font-bold font-heading" style={{ color: C.primary }}>
                  Recent Transactions
                </h3>
                <button
                  className="flex items-center gap-0.5 text-xs font-semibold font-body hover:opacity-70 transition-opacity"
                  style={{ color: C.brand }}
                >
                  See all <ChevronRight size={14} />
                </button>
              </div>
              <div>
                {RECENT_TRANSACTIONS.map((tx, i) => (
                  <TransactionRow key={tx.id} tx={tx} index={i} />
                ))}
              </div>
            </div>
          </motion.section>

          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}
