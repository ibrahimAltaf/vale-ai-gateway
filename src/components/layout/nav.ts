import {
  Activity,
  Braces,
  Building2,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Network,
  Settings,
  Shield,
  SquareTerminal,
  Wallet,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, group: "Operate" },
  { href: "/playground", label: "Playground", icon: SquareTerminal, group: "Operate" },
  { href: "/requests", label: "Requests", icon: Activity, group: "Operate" },
  { href: "/privacy", label: "Privacy", icon: Shield, group: "Control" },
  { href: "/cache", label: "Cache lab", icon: KeyRound, group: "Control" },
  { href: "/organisations", label: "Organisations", icon: Building2, group: "Control" },
  { href: "/savings", label: "Savings", icon: Wallet, group: "Control" },
  { href: "/health", label: "Health", icon: HeartPulse, group: "System" },
  { href: "/architecture", label: "Architecture", icon: Network, group: "System" },
  { href: "/settings", label: "Settings", icon: Settings, group: "System" },
  { href: "/engineering", label: "Engineering", icon: Braces, group: "System" },
] as const;
