import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/" },
      { label: "Explore", to: "/posts" },
      { label: "Write", to: "/create" },
      { label: "Pricing", to: "/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/" },
      { label: "Careers", to: "/" },
      { label: "Press", to: "/" },
      { label: "Contact", to: "/" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", to: "/" },
      { label: "Changelog", to: "/" },
      { label: "Community", to: "/" },
      { label: "Status", to: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-surface">
      <div className="container-page grid gap-10 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A quiet, considered blogging platform for developers, designers and independent writers.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <input
              placeholder="you@company.com"
              className="h-9 w-full max-w-[220px] rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
            <button className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
              Subscribe
            </button>
          </div>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {c.title}
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-foreground/80 transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© 2026 Inkwell Labs, Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground">Terms</Link>
            <Link to="/" className="hover:text-foreground">Privacy</Link>
            <Link to="/" className="hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
