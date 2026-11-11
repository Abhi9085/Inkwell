import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { PostCard, PostCardSkeleton } from "@/components/post-card";
import api from "@/lib/api";
import type { Post } from "@/lib/types";

export const Route = createFileRoute("/posts/")({
  head: () => ({ meta: [{ title: "All posts — Inkwell" }] }),
  component: AllPosts,
});

const sorts = ["Most recent", "Most read", "Most liked", "Trending"] as const;

type SortOption = (typeof sorts)[number];

function AllPosts() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<SortOption>(sorts[0]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const perPage = 9;

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get<Post[]>("/posts");
        setAllPosts(
          (response.data || []).filter(
            (post) =>
              post.status === "Public" &&
              post.publishedAt !== null
          )
        );
      } catch (err) {
        console.error("Failed to load Explore posts:", err);
        setError("Failed to load stories. Please try again.");
        setAllPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(
        allPosts
          .map((post) => post.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...categories];
  }, [allPosts]);

  const filtered = useMemo(() => {
    let list = [...allPosts];

    if (cat !== "All") {
      list = list.filter((post) => post.category === cat);
    }

    switch (sort) {
      case "Most read":
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;

      case "Most liked":
        list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;

      case "Trending":
        list = list
          .filter((post) => post.trending)
          .sort((a, b) => (b.views || 0) - (a.views || 0));
        break;

      case "Most recent":
      default:
        list.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt).getTime();
          return dateB - dateA;
        });
        break;
    }

    return list;
  }, [allPosts, cat, sort]);

  useEffect(() => {
    setPage(1);
  }, [cat, sort]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = q.trim();
    if (!value) return;

    window.location.href = `/search?q=${encodeURIComponent(value)}`;
  };

  const handleReset = () => {
    setQ("");
    setCat("All");
    setSort(sorts[0]);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      {/* header */}
      <section className="relative z-30 border-b border-border/60">
        <div className="absolute inset-0 bg-hero-gradient opacity-70" />

        <div className="container-page relative py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Explore
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            All stories
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Longform essays, short notes and technical deep-dives from writers around the world.
          </p>

          <div className="relative z-100 mt-8 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search articles, authors, topics…"
                className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm shadow-soft outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
              />
            </form>

            <SelectPill
              label={cat}
              icon={<SlidersHorizontal className="h-4 w-4" />}
              options={categoryOptions}
              onSelect={(value) => setCat(value)}
            />

            <SelectPill
              label={sort}
              options={[...sorts]}
              onSelect={(value) => setSort(value as SortOption)}
            />
          </div>
        </div>
      </section>

      <main className="relative z-0 container-page py-10">
        {error ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-sm font-medium text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <PostCardSkeleton key={index} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyResults query={q} onReset={handleReset} />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paged.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-40 hover:bg-secondary"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const number = index + 1;
                  const active = number === page;

                  return (
                    <button
                      type="button"
                      key={number}
                      onClick={() => setPage(number)}
                      className={`h-9 w-9 rounded-md text-sm ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-secondary"
                      }`}
                    >
                      {number}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-40 hover:bg-secondary"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SelectPill({
  label,
  icon,
  options,
  onSelect,
}: {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${open ? "z-120" : "z-10"}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3.5 text-sm shadow-soft hover:bg-secondary md:w-auto"
      >
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-foreground">{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-130"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-full z-140 mt-2 w-52 origin-top-right overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-floating">
            {options.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${
                  option === label ? "bg-secondary/70 font-medium" : ""
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyResults({
  query,
  onReset,
}: {
  query: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="mt-6 text-lg font-semibold">
        {query ? `No results for "${query}"` : "No stories match these filters"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Try another filter, or clear the filters to see everything on Inkwell.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Clear filters
      </button>
    </div>
  );
}
