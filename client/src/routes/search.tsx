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

  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery.trim()) {
      setPosts([]);
      setUsers([]);
      return;
    }

    const performSearch = async () => {
      setSearching(true);

      try {
        const response = await api.get("/search", {
          params: {
            q: initialQuery,
          },
        });

        setPosts(response.data.posts);
        setUsers(response.data.users);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setSearching(false);
      }
    };

    performSearch();
  }, [initialQuery]);

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