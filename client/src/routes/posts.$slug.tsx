import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { PostCard } from "@/components/post-card";
import api from "@/lib/api";
import { formatDate } from "@/lib/format-date";
import type { Post } from "@/lib/types";
import PostContent from "@/components/post/post-content";
import PostActions from "@/components/post/post-actions";
import { usePostShare } from "@/hooks/use-post-share";
import PostFloatingActions from "@/components/post/post-floating-actions";
import { PostComments } from "@/components/post-comments";
import { usePostComments } from "@/hooks/use-post-comments";
import { usePostSocket } from "@/hooks/use-post-socket";
import { usePostLikes } from "@/hooks/use-post-likes";
import { usePostBookmark } from "@/hooks/use-post-bookmark";
import { usePostFollow } from "@/hooks/use-post-follow";
import { usePostViews } from "@/hooks/use-post-views";
import { useReadingProgress } from "@/hooks/use-reading-progress";

export const Route = createFileRoute("/posts/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    let response;
  
    try {
      response = await api.get(`/posts/${params.slug}`);
    } catch (error) {
      const status = (
        error as { response?: { status?: number } }
      )?.response?.status;
    
      if ([401, 403, 404].includes(status ?? 0)) {
        throw notFound();
      }
    
      // Unexpected errors should reach the error component.
      throw error;
    }
  
    if (!response.data) {
      throw notFound();
    }
  
    const related = await api
      .get("/posts/discover", {
        params: { sort: "trending", limit: 5 },
      })
      .then((discovery) =>
        (discovery.data.posts ?? [])
          .filter((p: Post) => p.slug !== params.slug)
          .slice(0, 3)
      )
      .catch((error) => {
        console.warn("Related stories are temporarily unavailable:", error);
        return [] as Post[];
      });
    
    return { post: response.data, related };
  },

  head: ({ loaderData }) =>
    loaderData
      ? {
        meta: [
          { title: `${loaderData.post.title} — Inkwell` },
          { name: "description", content: loaderData.post.excerpt },
          { property: "og:title", content: loaderData.post.title },
          { property: "og:description", content: loaderData.post.excerpt },
          { property: "og:image", content: loaderData.post.cover },
        ],
      }
      : { meta: [{ title: "Loading story... — Inkwell" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: PostNotFound,
  component: PostPage,
});

function PostPage() {
  const { post, related } = Route.useLoaderData() as { post: Post; related: Post[] };

  const {
    liked,
    likesCount,
    setLikesCount,
    handleLike,
  } = usePostLikes({
    postId: Number(post.id),
    initialLiked: post.likedByMe ?? false,
    initialLikes: post.likes ?? 0,
  });

  const commentState = usePostComments(Number(post.id));

  usePostSocket({
    postId: Number(post.id),
    setLikesCount,
    setComments: commentState.setComments,
    setCommentsCount: commentState.setCommentsCount,
  });

  const { commentsCount } = commentState;
  const {
    shareOnX,
    shareOnFacebook,
    copyPostLink,
    handleShare,
  } = usePostShare({
    title: post.title,
    excerpt: post.excerpt,
  });

  const {
    saved,
    handleBookmark,
  } = usePostBookmark({
    postId: Number(post.id),
  });

  const {
    following,
    followersCount,
    isFollowing,
    handleFollow,
  } = usePostFollow({
    authorId: Number(post.author.id),
  });

  const { viewCount } = usePostViews({
    postId: Number(post.id),
    initialViews: post.views || 0,
  });

  const progress = useReadingProgress();

  // Safely parse the markdown body into sections
  const contentBody = post.content || "";
  const sections = contentBody.split(/\n## /).map((s, i) => ({
    id: `section-${i}`,
    heading: i === 0 ? "Introduction" : s.split("\n")[0],
    body: i === 0 ? s : s.split("\n").slice(1).join("\n"),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      {/* progress */}
      <div className="fixed left-0 right-0 top-16 z-30 h-0.5 bg-transparent">
        <div className="h-full bg-brand-gradient transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      {/* hero */}
      <header className="relative">
        <div className="relative aspect-21/9 w-full overflow-hidden bg-secondary md:aspect-21/8">
          {post.cover && (
            <img src={post.cover} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
        </div>
        <div className="container-page relative -mt-24 md:-mt-32">
          <Link to="/home" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All stories
          </Link>
          <div className="mt-4 max-w-3xl">
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
              {post.category || "Uncategorized"}
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
              {post.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  to="/profile/user/$id"
                  params={{ id: String(post.author.id) }}
                  className="flex items-center gap-3 hover:opacity-80"
                >
                  <img
                    src={post.author?.avatar || "/default-avatar.jpg"}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                
                  <div>
                    <p className="text-sm font-medium">
                      {post.author?.name || "Unknown Author"}
                    </p>
                        
                    <p className="text-xs text-muted-foreground">
                      {formatDate(post.publishedAt || new Date().toISOString())} ·{" "}
                      {post.readingTime || 1} min read
                    </p>
                  </div>
                </Link>
              <button
                type="button"
                onClick={handleFollow}
                disabled={isFollowing}
                className={`ml-auto rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors ${following
                    ? "bg-secondary text-foreground"
                    : "hover:bg-secondary"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isFollowing
                  ? "..."
                  : following
                    ? "Following"
                    : "Follow author"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page mt-12 grid gap-12 pb-20 lg:grid-cols-[220px_minmax(0,1fr)_180px]">
        
        {/* TOC */}
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
          <nav className="mt-4 space-y-2 border-l border-border pl-3 text-sm">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-muted-foreground transition-colors hover:text-foreground">
                {s.heading}
              </a>
            ))}
          </nav>
        </aside>

        {/* content */}
        <article className="mx-auto max-w-2xl">
          <PostContent sections={sections} tags={post.tags} />

          {/* actions */}
            <PostActions
              liked={liked}
              likesCount={likesCount}
              viewCount={viewCount}
              commentsCount={commentsCount}
              saved={saved}
              handleLike={handleLike}
              handleBookmark={handleBookmark}
              shareOnX={shareOnX}
              shareOnFacebook={shareOnFacebook}
              copyPostLink={copyPostLink}
            />

            <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-start gap-4">
                <Link
                  to="/profile/user/$id"
                  params={{ id: String(post.author.id) }}
                  className="flex min-w-0 flex-1 items-start gap-4 hover:opacity-80"
                >
                  <img
                    src={post.author?.avatar || "/default-avatar.jpg"}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
              
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Written by</p>
                        
                    <h3 className="text-lg font-semibold">
                      {post.author?.name || "Unknown Author"}
                    </h3>
                        
                    <p className="mt-1 text-sm text-muted-foreground">
                      {post.author?.bio || "No bio available."}
                    </p>
                        
                    <p className="mt-2 text-xs text-muted-foreground">
                      {followersCount}{" "}
                      {followersCount === 1 ? "follower" : "followers"}
                    </p>
                  </div>
                </Link>
                        
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={isFollowing}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    following
                      ? "bg-secondary text-foreground"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isFollowing ? "..." : following ? "Following" : "Follow"}
                </button>
              </div>
            </div>
          <PostComments {...commentState} />
        </article>

        {/* right rail */}
        <PostFloatingActions
          liked={liked}
          saved={saved}
          handleLike={handleLike}
          handleBookmark={handleBookmark}
          handleShare={handleShare}
        />
      </div>

      {/* related */}
      {related && related.length > 0 && (
        <section className="container-page pb-24">
          <h2 className="mb-6 text-xl font-semibold tracking-tight">More stories to read</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {related.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function PostNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />
      <div className="container-page grid place-items-center py-32 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Story unavailable</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">This story doesn't exist</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          It may have been unpublished by the author, or the link is out of date.
        </p>
        <Link to="/home" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
          Browse all stories
        </Link>
      </div>
    </div>
  );
}