import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Navbar } from "@/components/navbar";
import { PostCard } from "@/components/post-card";
import api from "@/lib/api";
import type { Post } from "@/lib/types";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [{ title: "Library — Inkwell" }],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const response = await api.get("/bookmarks/mine");
        setPosts(response.data);
      } catch (error) {
        console.error("Failed to load library:", error);
        toast.error("Failed to load your library");
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  const handleRemoveBookmark = async (postId: number) => {
    try {
      await api.delete(`/posts/${postId}/bookmark`);

      setPosts((current) =>
        current.filter((post) => post.id !== postId)
      );

      toast.success("Removed from library");
    } catch (error) {
      console.error("Failed to remove bookmark:", error);
      toast.error("Failed to remove from library");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <main className="container-page py-12">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary">
            <Bookmark className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Your Library
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Stories you've saved for later.
            </p>
          </div>
        </div>

        {loading && (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-xl bg-secondary"
              />
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              Your library is empty
            </h2>

            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Save interesting stories while exploring Inkwell and
              they'll appear here.
            </p>

            <Link
              to="/home"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Explore stories
            </Link>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <>
            <div className="mt-10">
              <p className="text-sm text-muted-foreground">
                {posts.length}{" "}
                {posts.length === 1 ? "saved story" : "saved stories"}
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <div key={post.id} className="relative">
                  <PostCard post={post} />

                  <button
                    type="button"
                    onClick={() => handleRemoveBookmark(post.id)}
                    className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-secondary hover:text-foreground"
                    title="Remove from library"
                  >
                    <Bookmark className="h-4 w-4 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}