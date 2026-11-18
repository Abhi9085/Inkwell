import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  LogOut,
  Menu,
  Moon,
  PenSquare,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Logo } from "./logo";

import api from "../lib/api";

import { connectSocket, socket } from "@/lib/socket";

export function Navbar({
  variant = "marketing",
}: {
  variant?: "marketing" | "app";
}) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const nav = [
    ...(user ? [{ to: "/home", label: "Feed" }] : []),
    { to: "/posts", label: "Explore" },
    ...(user ? [{ to: "/library", label: "Saved" }] : []),
  ];

  const [unreadCount, setUnreadCount] = useState(0);



  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await api.get("/notifications");
      setUnreadCount(response.data.unreadCount ?? 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    let active = true;

    const joinUserRoom = () => {
      socket.emit("user:join", user.id, (ack: { ok: boolean; error?: string }) => {
        if (!active) return;

        if (!ack?.ok) {
          console.error("Failed to join notification room:", ack?.error);
          return;
        }

        void fetchNotifications();
      });
    };

    const handleNewNotification = () => {
      if (active) {
        void fetchNotifications();
      }
    };

    const handleNotificationsUpdated = () => {
      if (active) {
        void fetchNotifications();
      }
    };

    socket.on("connect", joinUserRoom);
    socket.on("notification:new", handleNewNotification);
    window.addEventListener(
      "notifications-updated",
      handleNotificationsUpdated
    );

    connectSocket();

    if (socket.connected) {
      joinUserRoom();
    }

    return () => {
      active = false;
      socket.off("connect", joinUserRoom);
      socket.off("notification:new", handleNewNotification);
    
      window.removeEventListener(
        "notifications-updated",
        handleNotificationsUpdated
      );
    };
  }, [user?.id, fetchNotifications]);

  // Keep navbar auth state in sync with localStorage and logout events.
  useEffect(() => {
    const loadUser = () => {
      const storedUser = localStorage.getItem("user");
    
      if (!storedUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }
    
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
        setUser(null);
      }
    
      setAuthReady(true);
    };

    loadUser();

    window.addEventListener("auth-changed", loadUser);
    window.addEventListener("storage", loadUser);

    return () => {
      window.removeEventListener("auth-changed", loadUser);
      window.removeEventListener("storage", loadUser);
    };
  }, []);

  const handleLogout = async () => {
      if (user?.id && socket.connected) {
        socket.emit("user:leave", user.id);
      }
      try { await api.post("/auth/logout"); } catch (error) { console.warn("Server logout failed; clearing local session", error); }
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Update this navbar immediately and notify any other navbar instance.
    setUser(null);
    window.dispatchEvent(new Event("auth-changed"));

    // Always return to the public landing page after logout.
    navigate({ to: "/", replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const value = searchQuery.trim();

    if (!value) return;

    setMobileMenuOpen(false);
    window.location.href = `/search?q=${encodeURIComponent(value)}`;
  };

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="container-page relative flex min-h-16 flex-wrap items-center gap-3 py-2 sm:gap-4">
        <Logo />

        {variant === "app" && (
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {nav
              .filter((item) => user || item.to !== "/profile")
              .map((item) => {
                const active =
                  pathname === item.to || pathname.startsWith(item.to + "/");

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        )}

        {variant === "app" && (
          <form
            onSubmit={handleSearchSubmit}
            className="relative ml-2 hidden max-w-md flex-1 lg:flex"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stories, tags, authors…"
              className="h-9 w-full rounded-lg border border-border bg-secondary/60 pl-9 pr-16 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:ring-4 focus:ring-ring/15"
            />

            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-block">
              ⌘ K
            </kbd>
          </form>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {variant === "app" && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {!authReady ? null : user ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() => {
                    navigate({ to: "/notifications" });
                  }}
                  className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Bell className="h-4 w-4" />
                
                  {unreadCount > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
                      aria-label={`${unreadCount} unread notifications`}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </div>


              <Link
                to="/create"
                className="ml-1 hidden h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:opacity-90 lg:inline-flex"
              >
                <PenSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Write</span>
              </Link>

              <Link
                to="/profile"
                className="ml-1 grid h-9 w-9 place-items-center overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-ring/30"
                aria-label="Profile"
                title="Profile"
              >
                <img
                  src={
                    user.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                  }
                  alt={user.name}
                  className="h-full w-full rounded-full object-cover"
                />
              </Link>

              <button
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="ml-1 grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-foreground/80 hover:text-foreground sm:inline-flex"
              >
                Log in
              </Link>

              <Link
                to="/signup"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
        {variant === "app" && mobileMenuOpen && (
          <div className="w-full basis-full border-t border-border/60 py-4 lg:hidden">
            <form
              onSubmit={handleSearchSubmit}
              className="relative mb-4"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stories, tags, authors..."
                className="h-10 w-full rounded-lg border border-border bg-secondary/60 pl-9 pr-4 text-sm outline-none focus:border-ring focus:bg-background focus:ring-4 focus:ring-ring/15"
              />
            </form>

            <nav className="flex flex-col gap-1">
              {nav.map((item) => {
                const active =
                  pathname === item.to ||
                  pathname.startsWith(item.to + "/");

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {user ? (
                <>
                  <Link
                    to="/create"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-secondary"
                  >
                    <PenSquare className="h-4 w-4" />
                    Write a story
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  Log in
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export function MinimalHeader() {
  return (
    <header className="border-b border-border/60">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to site
        </Link>
      </div>
    </header>
  );
}
