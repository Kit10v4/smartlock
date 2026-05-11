"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/music", label: "Music" },
  { href: "/gallery", label: "Gallery" },
  { href: "/weather", label: "Weather" },
  { href: "/settings", label: "Settings" }
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(15,15,25,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)"
      }}
    >
      <div className="container row" style={{ justifyContent: "space-between" }}>
        <strong>Smart Clock</strong>
        <div className="row">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pill"
              style={{
                background: pathname === item.href ? "var(--accent)" : "var(--card)",
                color: pathname === item.href ? "#07131a" : "var(--text)"
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
