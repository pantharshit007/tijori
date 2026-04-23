import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Clock,
  Code2,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Share2,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PanelId = "dashboard" | "shared" | "allProjects";

const MOCK_VARIABLES = [
  {
    name: "DATABASE_URL",
    env: "PRODUCTION",
    date: "Apr 18, 2026",
    value: "postgres://prod:****@db.acme.io",
  },
  {
    name: "JWT_SECRET",
    env: "PRODUCTION",
    date: "Apr 17, 2026",
    value: "sk_live_a8f2…x9k1",
  },
  {
    name: "STRIPE_KEY",
    env: "STAGING",
    date: "Apr 16, 2026",
    value: "pk_test_51Abc…",
  },
  {
    name: "REDIS_HOST",
    env: "DEVELOPMENT",
    date: "Apr 15, 2026",
    value: "redis://10.0.0.12:6379",
  },
];

const MOCK_PROJECTS = [
  {
    name: "Acme Platform",
    role: "owner",
    description: "Core infrastructure secrets",
    updated: "Updated 2h ago",
  },
  {
    name: "Frontend App",
    role: "admin",
    description: "Client-side configuration",
    updated: "Updated 1d ago",
  },
  {
    name: "Microservices",
    role: "member",
    description: "Internal service keys",
    updated: "Updated 3d ago",
  },
];

const MOCK_SHARED = [
  {
    label: "API Keys share",
    envProject: "Production / Acme Platform",
    createdBy: "Jane",
    expiry: "in 23h",
    views: 3,
    status: "Active" as const,
  },
  {
    label: "Staging DB creds",
    envProject: "Staging / Frontend App",
    createdBy: "Alex",
    expiry: "in 6d",
    views: 0,
    status: "Active" as const,
  },
];

interface SidebarItem {
  icon: typeof LayoutDashboard;
  label: string;
  panelId: PanelId;
}

const SIDEBAR_NAV: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", panelId: "dashboard" },
  { icon: Share2, label: "Shared", panelId: "shared" },
  { icon: FolderOpen, label: "All Projects", panelId: "allProjects" },
];

export function DashboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId>("dashboard");
  const hasAnimatedRef = useRef(false);

  // Intersection observer for scroll-triggered entrance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Mark initial animation as done after stagger completes
          setTimeout(() => {
            hasAnimatedRef.current = true;
          }, 1400);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // On first load use stagger; on panel switch use instant (no delay)
  const stagger = useCallback(
    (i: number) =>
      hasAnimatedRef.current ? { animationDelay: "0ms" } : { animationDelay: `${400 + i * 100}ms` },
    []
  );

  return (
    <div ref={containerRef} className="mt-16 relative mx-auto max-w-6xl">
      {/* Ambient glow behind the preview */}
      <div className="absolute -inset-6 bg-primary/5 blur-3xl rounded-3xl  pointer-events-none" />

      <div
        className={`relative rounded-2xl border border-border/40 bg-background/80 shadow-2xl shadow-black/10 dark:shadow-black/30 p-1.5 backdrop-blur-xl transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* ── Browser chrome ── */}
        <div className="rounded-xl border border-border/30 bg-background overflow-hidden">
          <div className="h-10 bg-muted/20 border-b border-border/30 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]/70" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-muted/40 rounded-md h-5.5 w-64 flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground/80 tracking-wider font-mono">
                  tijori.hrshit.in/d/
                  {activePanel === "dashboard"
                    ? "project/acme"
                    : activePanel === "shared"
                      ? "shared"
                      : "dashboard"}
                </span>
              </div>
            </div>
            <div className="w-14" />
          </div>

          {/* ── App layout: sidebar + main ── */}
          <div className="flex" style={{ minHeight: "520px" }}>
            {/* ── Sidebar ── */}
            <Sidebar
              isVisible={isVisible}
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              stagger={stagger}
            />

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {activePanel === "dashboard" && (
                <AllProjectsPanel isVisible={isVisible} stagger={stagger} />
              )}
              {activePanel === "shared" && <SharedPanel isVisible={isVisible} stagger={stagger} />}
              {activePanel === "allProjects" && (
                <DashboardPanel isVisible={isVisible} stagger={stagger} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  isVisible,
  activePanel,
  onPanelChange,
  stagger,
}: {
  isVisible: boolean;
  activePanel: PanelId;
  onPanelChange: (p: PanelId) => void;
  stagger: (i: number) => { animationDelay: string };
}) {
  return (
    <div
      className={`w-52 shrink-0 border-r border-border/30 bg-muted/[0.04] flex flex-col justify-between dshb-slide-in-left ${
        isVisible ? "dshb-animate" : ""
      }`}
    >
      <div>
        {/* Logo */}
        <div className="px-4 py-3.5 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <KeyRound className="size-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs font-bold leading-none">Tijori</div>
            <div className="text-[9px] text-muted-foreground leading-none mt-0.5">Secure Vault</div>
          </div>
        </div>

        {/* Nav */}
        <div className="px-2.5 mt-1">
          <div className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-2">
            Navigation
          </div>
          {SIDEBAR_NAV.map((item, i) => (
            <button
              key={item.label}
              onClick={() => onPanelChange(item.panelId)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] mb-0.5 transition-all cursor-pointer ${
                activePanel === item.panelId
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/20"
              } dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
              style={stagger(i)}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Usage */}
        <div className="px-2.5 mt-5">
          <div className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-2">
            Usage
          </div>
          <div
            className={`px-2.5 py-1.5 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
            style={stagger(4)}
          >
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1.5">
              <span>PROJECTS</span>
              <span>3 / ∞</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-1000"
                style={{ width: isVisible ? "25%" : "0%", transitionDelay: "800ms" }}
              />
            </div>
          </div>
          <div
            className={`px-2.5 py-1.5 mt-1 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
            style={stagger(5)}
          >
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1.5">
              <span>SHARED SECRETS</span>
              <span>NO LIMIT</span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="px-2.5 mt-5">
          <div className="text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-2">
            Account
          </div>
          {[
            { label: "Profile", Icon: User },
            { label: "Settings", Icon: Settings },
          ].map(({ label, Icon }, i) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] text-muted-foreground mb-0.5 dshb-fade-in ${
                isVisible ? "dshb-animate" : ""
              }`}
              style={stagger(6 + i)}
            >
              <Icon className="size-3.5" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* User card */}
      <div
        className={cn(
          "border-t border-border/20 px-3.5 py-3 flex items-center gap-2.5 dshb-fade-in",
          isVisible && "dshb-animate"
        )}
        style={stagger(9)}
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center shadow-sm">
          <span className="text-[9px] font-bold text-primary-foreground">JD</span>
        </div>
        <div>
          <div className="text-[12px] text-left font-semibold leading-none">Jane Doe</div>
          <div className="text-[9px] text-muted-foreground leading-none mt-0.5">jane@acme.dev</div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel: Dashboard (Your Projects)
   ────────────────────────────────────────────────────────────── */

function DashboardPanel({
  isVisible,
  stagger,
}: {
  isVisible: boolean;
  stagger: (i: number) => { animationDelay: string };
}) {
  return (
    <div className="p-6">
      {/* Header */}
      <div
        className={`flex items-start justify-between mb-6 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(1)}
      >
        <div>
          <h3 className="text-base font-bold leading-tight">Dashboard</h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            Manage your secure project environment variables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border/30 rounded-lg overflow-hidden">
            <div className="p-1.5 bg-primary/10">
              <svg className="size-3 text-primary" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </div>
            <div className="p-1.5 border-l border-border/30">
              <svg
                className="size-3 text-muted-foreground/40"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg shadow-sm shadow-primary/20">
            <Plus className="size-3" />
            New Project
          </div>
        </div>
      </div>

      {/* Section title */}
      <div
        className={`text-xs font-bold mb-3 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(2)}
      >
        Your Projects
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MOCK_PROJECTS.map((proj, i) => (
          <div
            key={proj.name}
            className={`group rounded-xl border border-border/30 bg-muted/[0.03] p-4 hover:border-primary/30 hover:bg-muted/[0.06] transition-all cursor-default dshb-fade-in ${
              isVisible ? "dshb-animate" : ""
            }`}
            style={stagger(3 + i)}
          >
            <div className="flex items-start gap-2.5 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-border/20 flex items-center justify-center shrink-0">
                <FolderOpen className="size-3.5 text-primary/60" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold truncate group-hover:text-primary transition-colors">
                  {proj.name}
                </div>
                <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">
                  {proj.role}
                </span>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground mb-3 leading-relaxed">
              {proj.description}
            </p>
            <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
              <Clock className="size-2.5" />
              {proj.updated}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel: Shared Secrets
   ────────────────────────────────────────────────────────────── */

function SharedPanel({
  isVisible,
  stagger,
}: {
  isVisible: boolean;
  stagger: (i: number) => { animationDelay: string };
}) {
  return (
    <div className="p-6">
      {/* Header */}
      <div className={`mb-5 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`} style={stagger(1)}>
        <h3 className="text-base font-bold leading-tight">Shared Secrets</h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          Manage your shared environment variable links and track their usage.
        </p>
      </div>

      {/* Search */}
      <div
        className={`flex items-center gap-2.5 mb-4 dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(2)}
      >
        <div className="flex-1 flex items-center gap-2 text-[10px] border border-border/30 rounded-lg px-3 py-2 bg-muted/5">
          <Search className="size-3 text-muted-foreground/40" />
          <span className="text-muted-foreground/40">Search by project or environment...</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border border-border/30 rounded-lg px-2.5 py-1.5">
          All Status <ChevronDown className="size-2.5" />
        </div>
      </div>

      {/* Table */}
      <div
        className={`rounded-xl border border-border/20 overflow-hidden dshb-fade-in ${isVisible ? "dshb-animate" : ""}`}
        style={stagger(3)}
      >
        {/* Table header */}
        <div className="grid grid-cols-[1.4fr_1.6fr_1fr_0.7fr_0.5fr_0.6fr_0.3fr] gap-3 px-4 py-2.5 bg-muted/[0.04] border-b border-border/20 text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider items-center">
          <span>Label</span>
          <span>Env / Project</span>
          <span>Created By</span>
          <span className="text-center">Expiry</span>
          <span className="text-center">Views</span>
          <span className="text-center">Status</span>
          <span />
        </div>

        {/* Table rows */}
        {MOCK_SHARED.map((item, i) => (
          <div
            key={item.label}
            className={`grid grid-cols-[1.4fr_1.6fr_1fr_0.7fr_0.5fr_0.6fr_0.3fr] gap-3 px-4 py-3 border-b border-border/10 items-center hover:bg-muted/[0.03] transition-colors dshb-fade-in ${
              isVisible ? "dshb-animate" : ""
            }`}
            style={stagger(4 + i)}
          >
            <span className="text-[10px] font-semibold truncate">{item.label}</span>
            <span className="text-[9px] text-muted-foreground truncate">{item.envProject}</span>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center">
                <span className="text-[6px] font-bold text-primary-foreground">
                  {item.createdBy[0]}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground">{item.createdBy}</span>
            </div>
            <span className="text-[9px] text-muted-foreground text-center">{item.expiry}</span>
            <div className="flex items-center justify-center">
              <div className="h-4 w-4 rounded-full bg-muted/20 flex items-center justify-center">
                <span className="text-[7px] font-bold text-muted-foreground">{item.views}</span>
              </div>
            </div>
            <span className="text-[8px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full w-fit mx-auto">
              {item.status}
            </span>
            <button className="text-muted-foreground/40 justify-self-end" tabIndex={-1}>
              <MoreHorizontal className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel: All Projects (Project Detail View with Variables)
   ────────────────────────────────────────────────────────────── */

function AllProjectsPanel({
  isVisible,
  stagger,
}: {
  isVisible: boolean;
  stagger: (i: number) => { animationDelay: string };
}) {
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());
  const [cursorVisible, setCursorVisible] = useState(true);
  const [searchText, setSearchText] = useState("");
  const fullSearchText = "DATABASE";

  // Typing animation for search bar
  useEffect(() => {
    if (!isVisible) return;
    const startDelay = setTimeout(() => {
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i <= fullSearchText.length) {
          setSearchText(fullSearchText.slice(0, i));
          i++;
        } else {
          clearInterval(typeInterval);
          setTimeout(() => {
            let j = fullSearchText.length;
            const eraseInterval = setInterval(() => {
              if (j >= 0) {
                setSearchText(fullSearchText.slice(0, j));
                j--;
              } else {
                clearInterval(eraseInterval);
              }
            }, 60);
          }, 2000);
        }
      }, 120);
      return () => clearInterval(typeInterval);
    }, 1600);
    return () => clearTimeout(startDelay);
  }, [isVisible]);

  // Blinking cursor
  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(blink);
  }, []);

  const toggleReveal = useCallback((idx: number) => {
    setRevealedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      {/* Project header */}
      <div
        className={`px-6 py-4 border-b border-border/20 dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(1)}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold leading-tight">Acme Platform</h3>
              <span className="text-[8px] font-medium text-muted-foreground border border-border/30 px-1.5 py-0.5 rounded">
                owner
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Core infrastructure secrets</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border border-border/30 rounded-lg px-2.5 py-1.5 hover:bg-muted/10 transition-colors">
              <Lock className="size-3" />
              Lock
            </div>
            <div className="h-6 w-6 rounded-lg border border-border/30 flex items-center justify-center hover:bg-muted/10 transition-colors">
              <Users className="size-3 text-muted-foreground" />
            </div>
            <div className="h-6 w-6 rounded-lg border border-border/30 flex items-center justify-center hover:bg-muted/10 transition-colors">
              <Settings className="size-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mt-3 transition-colors">
          <span className="text-[11px] font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-lg cursor-pointer hover:bg-primary/90">
            Project
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer hover:bg-accent/10">
            <Share2 className="size-3" /> Shared
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className={`px-6 py-3 border-b border-border/10 flex items-center gap-3 dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(2)}
      >
        <div className="flex items-center gap-1.5 text-[11px] border border-border/30 rounded-lg px-3 py-1.5 bg-muted/10">
          <span className="font-medium">Production</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">
          <Plus className="size-3" /> Add
        </span>
      </div>

      {/* Search bar */}
      <div
        className={`px-6 py-2.5 border-b border-border/10 flex items-center gap-3 dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(3)}
      >
        <div className="flex-1 flex items-center gap-2 text-[11px] border border-border/30 rounded-lg px-3 py-2 bg-muted/5">
          <Search className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {searchText}
            <span
              className={`inline-block w-[1px] h-[11px] bg-primary ml-px align-middle transition-opacity ${
                cursorVisible ? "opacity-100" : "opacity-0"
              }`}
            />
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-medium">{MOCK_VARIABLES.length} variables</span>
        </div>
      </div>

      {/* Variable rows */}
      <div className="divide-y divide-border/10">
        {MOCK_VARIABLES.map((v, i) => {
          const isRevealed = revealedRows.has(i);
          return (
            <div
              key={v.name}
              className={`group px-6 py-3 flex items-center gap-3.5 hover:bg-muted/[0.04] transition-colors dshb-fade-in ${
                isVisible ? "dshb-animate" : ""
              }`}
              style={stagger(4 + i)}
            >
              {/* Icon */}
              <div className="h-8 w-8 rounded-lg bg-muted/10 border border-border/20 flex items-center justify-center shrink-0">
                <Code2 className="size-4 text-muted-foreground" />
              </div>

              {/* Name + env */}
              <div className="min-w-0 w-28 sm:w-36">
                <div className="text-[12px] font-semibold truncate">{v.name}</div>
                <div
                  className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${
                    v.env === "PRODUCTION"
                      ? "text-primary/70"
                      : v.env === "STAGING"
                        ? "text-blue-400/70"
                        : "text-emerald-400/70"
                  }`}
                >
                  {v.env}
                </div>
              </div>

              {/* Eye icon — click to toggle */}
              <button
                onClick={() => toggleReveal(i)}
                className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer p-0.5"
                tabIndex={-1}
                title={isRevealed ? "Hide value" : "Reveal value"}
              >
                {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>

              {/* Masked / revealed value */}
              <div className="min-w-0 overflow-hidden">
                {isRevealed ? (
                  <span className="text-[11px] font-mono text-emerald-400 tracking-tight dshb-decrypt">
                    {v.value}
                  </span>
                ) : (
                  <div className="flex gap-[3px] items-center">
                    {Array.from({ length: 14 }).map((_, di) => (
                      <span
                        key={di}
                        className="inline-block w-[5px] h-[5px] rounded-full bg-muted-foreground/30"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Spacer to push date & menu to right */}
              <div className="flex-1" />

              {/* Date */}
              <span className="hidden sm:block text-[9px] text-muted-foreground shrink-0 w-20 text-right">
                {v.date}
              </span>

              {/* Menu */}
              <button
                className="shrink-0 text-muted-foreground/20 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                tabIndex={-1}
              >
                <MoreVertical className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add row hint */}
      <div
        className={`px-6 py-4 flex items-center justify-center dshb-fade-in ${
          isVisible ? "dshb-animate" : ""
        }`}
        style={stagger(9)}
      >
        <div className="flex items-center gap-1.5 text-[10px] text-primary/50 border border-dashed border-primary/20 rounded-lg px-5 py-2.5 hover:border-primary/40 hover:text-primary/70 transition-colors cursor-default">
          <Plus className="size-3.5" />
          Add variable
        </div>
      </div>
    </div>
  );
}
