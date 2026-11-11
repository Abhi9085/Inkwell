import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-primary-foreground shadow-elevated">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20c0-6 6-10 12-10" />
          <path d="M14 6l4 4" />
          <path d="M20 4l-2 2" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Inkwell</span>
    </Link>
  );
}
