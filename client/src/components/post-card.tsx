
import { Link } from "@tanstack/react-router";
import { Clock, Eye, Heart } from "lucide-react";
import type { Post } from "@/lib/types";

function formatDate(date: string | null) {
  if (!date) return "No date";

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AuthorLink({
  post,
  avatarClass,
  nameClass,
}: {
  post: Post;
  avatarClass: string;
  nameClass: string;
}) {
  return (
    <Link
      to="/profile/user/$id"
      params={{ id: String(post.author.id) }}
      className="flex min-w-0 items-center gap-2 hover:opacity-80"
      aria-label={`View ${post.author.name}'s profile`}
    >
      <img
        src={post.author.avatar ?? "/default-avatar.jpg"}
        alt=""
        className={`${avatarClass} shrink-0 rounded-full object-cover`}
      />
      <span className={`min-w-0 truncate ${nameClass}`}>
        {post.author.name}
      </span>
    </Link>
  );
}

export function PostCard({
  post,
  variant = "default",
}: {
  post: Post;
  variant?: "default" | "compact" | "featured";
}) {
  if (variant === "featured") {
    return (
      <div className="group relative grid overflow-hidden rounded-2xl border border-border bg-card shadow-elevated transition-all hover:-translate-y-0.5 hover:shadow-floating md:grid-cols-2">
        <Link
          to="/posts/$slug"
          params={{ slug: post.slug }}
          className="relative aspect-16/10 overflow-hidden md:aspect-auto"
        >
          <img
            src={post.cover ?? "/placeholder-cover.jpg"}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>

        <div className="flex flex-col justify-between gap-6 p-6 md:p-8">
          <Link
            to="/posts/$slug"
            params={{ slug: post.slug }}
            className="block"
          >
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {post.category}
            </span>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {post.title}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              {post.excerpt}
            </p>
          </Link>

          <div className="flex items-center gap-3">
            <AuthorLink
              post={post}
              avatarClass="h-9 w-9"
              nameClass="text-sm font-medium"
            />

            <span className="text-xs text-muted-foreground">
              {formatDate(post.publishedAt ?? post.createdAt)} ·{" "}
              {post.readingTime} min read
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex gap-3">
        <Link
          to="/posts/$slug"
          params={{ slug: post.slug }}
          className="shrink-0"
        >
          <img
            src={post.cover ?? "/placeholder-cover.jpg"}
            alt=""
            className="h-16 w-16 rounded-lg object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to="/posts/$slug"
            params={{ slug: post.slug }}
            className="block line-clamp-2 text-sm font-medium leading-snug hover:text-accent"
          >
            {post.title}
          </Link>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <AuthorLink
              post={post}
              avatarClass="h-5 w-5"
              nameClass="text-xs"
            />
            <span>· {post.readingTime} min</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-elevated">
      <Link
        to="/posts/$slug"
        params={{ slug: post.slug }}
        className="relative block aspect-16/10 overflow-hidden"
      >
        <img
          src={post.cover ?? "/placeholder-cover.jpg"}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-[11px] font-medium text-foreground backdrop-blur">
          {post.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <Link
          to="/posts/$slug"
          params={{ slug: post.slug }}
          className="block"
        >
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground hover:text-accent">
            {post.title}
          </h3>

          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {post.excerpt}
          </p>
        </Link>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <AuthorLink
            post={post}
            avatarClass="h-7 w-7"
            nameClass="text-xs font-medium"
          />

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingTime}m
            </span>

            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {post.likes}
            </span>

            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.views >= 1000
                ? `${(post.views / 1000).toFixed(1)}k`
                : post.views.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-16/10 skeleton-shimmer" />

      <div className="flex flex-col gap-3 p-5">
        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        <div className="h-4 w-1/2 rounded skeleton-shimmer" />

        <div className="mt-4 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full skeleton-shimmer" />
          <div className="h-3 w-24 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
