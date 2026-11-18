import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Navbar } from "@/components/navbar";
import { PostCard } from "@/components/post-card";
import api from "@/lib/api";
import type { Post, UserSummary } from "@/lib/types";

export const Route = createFileRoute("/search")({
  validateSearch: (search) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initialQuery } = Route.useSearch();
  const navigate = useNavigate();

  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<"relevance" | "recent" | "popular">("relevance");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery.trim()) {
      setPosts([]);
      setUsers([]);
      setHasMore(false);
      setTotal(0);
      return;
    }

    let active = true;
    const performSearch = async () => {
      if (page === 1) setSearching(true);
      else setLoadingMore(true);

      try {
        const response = await api.get("/search", {
          params: { q: initialQuery, page, limit: 20, sort, category, tag },
        });
        if (!active) return;
        const nextPosts: Post[] = response.data.posts ?? [];
        setPosts((current) => page === 1 ? nextPosts : [...current, ...nextPosts]);
        if (page === 1) setUsers(response.data.users ?? []);
        setHasMore(Boolean(response.data.hasMore));
        setTotal(Number(response.data.total) || 0);
      } catch (error) {
        if (active) console.error("Search failed:", error);
      } finally {
        if (active) {
          setSearching(false);
          setLoadingMore(false);
        }
      }
    };

    performSearch();
    return () => { active = false; };
  }, [initialQuery, page, sort, category, tag]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();

    const value = query.trim();

    if (!value) return;

    await navigate({
      to: "/search",
      search: { q: value },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="container-page py-10">

        {!initialQuery ? (
          <div className="py-24 text-center">
            <SearchIcon className="mx-auto h-10 w-10 text-muted-foreground" />

            <h1 className="mt-4 text-xl font-semibold">
              Search Inkwell
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Find stories and authors.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-12 text-2xl font-semibold">
              Search results for "{initialQuery}"
            </h1>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Sort by</span>
                <select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }} className="w-full rounded-lg border border-border bg-background px-3 py-2">
                  <option value="relevance">Relevance</option>
                  <option value="recent">Most recent</option>
                  <option value="popular">Most liked</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Category</span>
                <input value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} placeholder="Filter category" className="w-full rounded-lg border border-border bg-background px-3 py-2" maxLength={60} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Tag</span>
                <input value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }} placeholder="Filter tag" className="w-full rounded-lg border border-border bg-background px-3 py-2" maxLength={40} />
              </label>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{total} matching stories</p>

            {searching ? (
              <p className="mt-8 text-sm text-muted-foreground">
                Searching...
              </p>
            ) : (
              <>
                {/* Authors */}
                {users.length > 0 && (
                  <section className="mt-8">
                    <h2 className="text-lg font-semibold">
                      Authors
                    </h2>

                    <div className="mt-4 space-y-3">
                      {users.map((user) => (
                        <Link
                          key={user.id}
                          to="/profile/user/$id"
                          params={{ id: String(user.id) }}
                          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:bg-secondary"
                        >
                          <img
                            src={
                              user.avatar ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                            }
                            alt={user.name}
                            className="h-12 w-12 rounded-full object-cover"
                          />

                          <div>
                            <p className="font-medium">
                              {user.name}
                            </p>

                            <p className="text-sm text-muted-foreground">
                              @{user.handle}
                            </p>

                            {user.bio && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {user.bio}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Stories */}
                <section className="mt-10">
                  <h2 className="text-lg font-semibold">
                    Stories
                  </h2>

                  {posts.length > 0 ? (
                    <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                      {posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 text-sm text-muted-foreground">
                      No stories found.
                    </p>
                  )}
                </section>

                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button type="button" disabled={loadingMore} onClick={() => setPage((current) => current + 1)} className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
                      {loadingMore ? "Loading..." : "Load more stories"}
                    </button>
                  </div>
                )}

                {users.length === 0 && posts.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nothing matched your search.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}