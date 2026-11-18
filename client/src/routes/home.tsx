import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { BookOpen, Lightbulb, Sparkles, TrendingUp } from "lucide-react";                                                      
import { PostCard } from "@/components/post-card";
import api from "../lib/api";
import type { Post, Author } from "@/lib/types";
import { usePostFollow } from "@/hooks/use-post-follow";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Your feed — Inkwell" }] }),
  component: HomePage,
});

function TopAuthor({ author }: { author: Author }) {
  const { following, isFollowing, handleFollow } = usePostFollow({
    authorId: author.id,
  });

  return (
    <li className="flex items-center gap-3">
      <Link
        to="/profile/user/$id"
        params={{ id: String(author.id) }}
        className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
      >
        <img
          src={author.avatar || "https://i.pravatar.cc/150"}
          alt={author.name}
          className="h-10 w-10 rounded-full object-cover"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{author.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {author.role || "Writer"}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleFollow}
        disabled={isFollowing}
        className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50"
      >
        {isFollowing ? "..." : following ? "Following" : "Follow"}
      </button>
    </li>
  );
}

function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [featuredPost, setFeaturedPost] = useState<Post | null>(null);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const response = await api.get("/posts/feed", { params: { limit: 30 } });
        const fetchedPosts: Post[] = response.data.posts ?? [];

        setPosts(fetchedPosts);

        // Immediate fallback while personalized recommendations load.
        setFeaturedPost(fetchedPosts[0] ?? null);
        setTrendingPosts(fetchedPosts.slice(1, 5));

        try {
          const personalized = await api.get("/posts/personalized");

          setFeaturedPost(
            personalized.data.featured ?? fetchedPosts[0] ?? null
          );

          setTrendingPosts(
            Array.isArray(personalized.data.trending)
              ? personalized.data.trending
              : fetchedPosts.slice(1, 5)
          );
        } catch (error) {
          // Public or unauthenticated visitors can still see the feed.
          console.warn("Personalized feed unavailable; using public discovery.", error);
          try {
            const discovery = await api.get("/posts/discover", { params: { sort: "trending", limit: 5 } });
            setTrendingPosts(discovery.data.posts ?? fetchedPosts.slice(1, 5));
          } catch (discoveryError) {
            console.warn("Discovery fallback unavailable.", discoveryError);
          }
        }
      } catch (error) {
        console.error("Failed to fetch feed", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, []);

  const latestPosts = posts.slice(0, 6);

  const popularTags = Array.from(
    posts.reduce((counts, post) => {
      const tags = Array.isArray(post.tags) ? post.tags : [];

      tags.forEach((tag) => {
        const name = tag.trim().replace(/^#/, "");

        if (name) {
          counts.set(name, (counts.get(name) || 0) + 1);
        }
      });

      return counts;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  
  const categoryCounts = Array.from(
    posts.reduce((counts, post) => {
      const name = post.category?.trim();

      if (name) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }

      return counts;
    }, new Map<string, number>())
  ).map(([name, count]) => ({ name, count }));

  // Extract a unique list of authors from the fetched posts for the sidebar
  const activeAuthors = Array.from(
    new Map(posts.map((post) => [post.author.id, post.author])).values()
  );

  return (
    <div className="min-h-screen bg-background">

      <main className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-10">
            {/* Featured */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Featured today</h2>
                <span className="text-xs text-muted-foreground">Picked for your interests</span>
              </div>
              {isLoading ? (
                <div className="h-64 rounded-xl bg-secondary/50 animate-pulse" />
              ) : featuredPost ? (
                <PostCard post={featuredPost} variant="featured" />
              ) : (
                <p className="text-sm text-muted-foreground">No posts published yet.</p>
              )}
            </section>

            {/* Categories */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Browse by category</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryCounts.map((c) => (
                  <Link
                    key={c.name}
                    to="/search"
                    search={{ q: c.name }}
                    className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm shadow-soft transition-all hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-elevated"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.count}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Trending */}
            {trendingPosts.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
                    <TrendingUp className="h-4 w-4 text-accent" /> Trending
                  </h2>
                  <Link to="/posts" className="text-sm text-accent hover:underline">View all</Link>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {trendingPosts.slice(0, 4).map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              </section>
            )}

            {/* Latest */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Sparkles className="h-4 w-4 text-accent" /> Latest posts
                </h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading latest...</p>
                ) : (
                  latestPosts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <SidebarCard title="Recent posts" icon={<BookOpen className="h-4 w-4" />}>
              <ul className="space-y-4">
                {posts.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <PostCard post={p} variant="compact" />
                  </li>
                ))}
              </ul>
            </SidebarCard>

            <SidebarCard title="Top authors">
              <ul className="space-y-4">
                {activeAuthors.map((author: Author) => (
                  <TopAuthor key={author.id} author={author} />
                ))}
                {activeAuthors.length === 0 && !isLoading && (
                  <p className="text-sm text-muted-foreground">No authors yet.</p>
                )}
              </ul>
            </SidebarCard>


            <SidebarCard title="Popular tags">
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map((t) => (
                  <Link
                    key={t}
                    to="/search"
                    search={{ q: t }}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-accent/10 hover:text-accent"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            </SidebarCard>

            <SidebarCard title="Reading tips" icon={<Lightbulb className="h-4 w-4" />}>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>· Save posts to read later with a single tap.</li>
                <li>· Follow tags to shape your feed over time.</li>
                <li>· Highlight passages to remember what mattered.</li>
              </ul>
            </SidebarCard>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SidebarCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <h3 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}