"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Ban,
  Briefcase,
  ChefHat,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Package,
  Warehouse,
  ClipboardList,
  Menu,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "POS", icon: ShoppingCart },
      { href: "/kitchen", label: "Kitchen", icon: ChefHat },
      { href: "/menu", label: "Public Menu", icon: ShoppingBag },
    ],
  },
  {
    title: "Store",
    items: [
      { href: "/store", label: "Store balance", icon: Package },
      { href: "/store/requests", label: "Saman request", icon: ClipboardList },
      { href: "/store/desk", label: "Store desk", icon: Warehouse },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/roles", label: "Role permissions", icon: ShieldCheck },
      { href: "/admin/menu", label: "Menu management", icon: UtensilsCrossed },
      { href: "/admin/cancellations", label: "Cancellations", icon: Ban },
      { href: "/admin/employees", label: "Employees", icon: Briefcase },
    ],
  },
];

function Sidebar({
  compact,
  pathname,
  onNavigate,
  showCollapse,
  collapsed,
  onToggleCollapse,
  onLogout,
}: {
  compact: boolean;
  pathname: string;
  onNavigate?: () => void;
  showCollapse: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center gap-3 px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500 text-lg font-bold text-white">
          K
        </span>
        {!compact && (
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">Khan Burger</p>
            <p className="truncate text-xs text-slate-400">Restaurant Admin</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            {!compact && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={compact ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150 ${
                      active
                        ? "bg-orange-500/15 text-orange-400"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!compact && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-[#1b2540] p-3">
        {showCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white md:flex"
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            {!compact && <span>Chhota karein</span>}
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!compact && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  userName,
  role,
  children,
}: {
  userName: string;
  role: string;
  children: ReactNode;
  canManageUsers?: boolean;
  canManageRoles?: boolean;
  canManageMenu?: boolean;
  canViewCancellations?: boolean;
  canViewEmployees?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-200">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#1b2540] bg-[#0f1629] transition-[width] duration-200 md:block ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <Sidebar
          compact={collapsed}
          pathname={pathname}
          showCollapse
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onLogout={logout}
        />
      </aside>

      {/* Mobile drawer (sirf button dabane par) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-[#1b2540] bg-[#0f1629]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-6 z-10 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Band karein"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar
              compact={false}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              showCollapse={false}
              collapsed={false}
              onToggleCollapse={() => {}}
              onLogout={logout}
            />
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-[#1b2540] bg-[#0b1020]/80 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white md:hidden"
            aria-label="Menu kholen"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-slate-400">{role}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-500/20 text-sm font-semibold text-orange-400">
              {initials}
            </span>
          </div>
        </header>

        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
