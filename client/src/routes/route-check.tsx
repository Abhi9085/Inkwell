
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/route-check")({
  component: RouteCheckPage,
});

type RouteItem = {
  name: string;
  path: string;
  access: "Public" | "Protected";
  note: string;
};

const routes: RouteItem[] = [
  { name: "Home", path: "/", access: "Public", note: "Homepage" },
  { name: "Explore", path: "/posts", access: "Public", note: "Published stories" },
  { name: "Search", path: "/search?q=test", access: "Public", note: "Search results" },
  { name: "Login", path: "/login", access: "Public", note: "Email and Google login" },
  { name: "Signup", path: "/signup", access: "Public", note: "Registration and Google signup" },
  { name: "My Profile", path: "/profile", access: "Protected", note: "Your posts and drafts" },
  { name: "Followers", path: "/profile/followers", access: "Protected", note: "Your followers" },
  { name: "Following", path: "/profile/following", access: "Protected", note: "Authors you follow" },
  { name: "Create Post", path: "/create", access: "Protected", note: "Write a story" },
  { name: "Library", path: "/library", access: "Protected", note: "Bookmarked stories" },
];

function RouteCheckPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [slug, setSlug] = useState("draft-testing-1");
  const [userId, setUserId] = useState("1");
  const [query, setQuery] = useState("test");

  useEffect(() => {
    setLoggedIn(Boolean(localStorage.getItem("token")));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/route-check";
  };

  const dynamicRoutes = [
    {
      name: "Story Preview",
      path: `/posts/${encodeURIComponent(slug.trim())}`,
      access: "Public",
      note: "Published stories are public; drafts should only open for their owner.",
    },
    {
      name: "Edit Story",
      path: `/edit/${encodeURIComponent(slug.trim())}`,
      access: "Protected",
      note: "Only the story owner should be able to edit.",
    },
    {
      name: "Public Author Profile",
      path: `/profile/user/${encodeURIComponent(userId.trim())}`,
      access: "Public",
      note: "Should open without logging in.",
    },
    {
      name: "Search Query",
      path: `/search?q=${encodeURIComponent(query.trim())}`,
      access: "Public",
      note: "Search stories and authors.",
    },
  ] as const;

  const renderRoute = (item: RouteItem | (typeof dynamicRoutes)[number]) => (
    <div
      key={item.name}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{item.name}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              item.access === "Public"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {item.access}
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {item.path}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
      </div>

      <a
        href={item.path}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Open route →
      </a>
    </div>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-sm text-primary hover:underline">
          ← Back to Inkwell
        </a>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Developer tools
            </p>
            <h1 className="mt-2 text-3xl font-bold">Route Tester</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Test public pages, protected pages, story access, and author profiles.
            </p>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="text-sm">
              Session:{" "}
              <strong>{loggedIn ? "Logged in" : "Logged out"}</strong>
            </p>
            {loggedIn ? (
              <button
                onClick={logout}
                className="mt-2 text-sm text-destructive hover:underline"
              >
                Sign out for testing
              </button>
            ) : (
              <a href="/login" className="mt-2 inline-block text-sm text-primary hover:underline">
                Go to login
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-secondary/30 p-4">
          <h2 className="font-semibold">How to test</h2>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Open every public route while logged out.</li>
            <li>Try protected routes while logged out; they should redirect to login or your chosen public landing page.</li>
            <li>Log in and repeat the protected-route tests.</li>
            <li>Try opening a draft as its owner and as another user.</li>
          </ol>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Main routes</h2>
          <div className="grid gap-3">{routes.map(renderRoute)}</div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Dynamic routes</h2>

          <div className="mb-4 grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
            <label className="text-sm">
              Story slug
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3"
                placeholder="my-story-slug"
              />
            </label>

            <label className="text-sm">
              Author user ID
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3"
                placeholder="1"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              Search query
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3"
                placeholder="Search term"
              />
            </label>
          </div>

          <div className="grid gap-3">{dynamicRoutes.map(renderRoute)}</div>
        </section>

        <div className="mt-8 rounded-xl border border-border p-4">
          <h2 className="font-semibold">Expected results</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Public pages should work without a session. Protected pages should
            require a session. A draft should never be returned by public listing
            or search APIs, and another user must not be able to access or edit it.
          </p>
        </div>
      </div>
    </main>
  );
}
