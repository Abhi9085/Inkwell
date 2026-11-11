import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  redirect,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportError } from "../lib/error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero-gradient px-4">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Error 404</p>
        <h1 className="mt-4 text-7xl font-bold tracking-tight text-foreground">Not found</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The page you're looking for doesn't exist, has been moved, or is being rewritten.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90"
          >
            Go home
          </Link>
          <Link
            to="/posts"
            className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Explore stories
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-gradient px-4">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive">Error 500</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Something went wrong on our end
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A temporary hiccup. Try again, or head back home while we look into it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const pathname = location.pathname.replace(/\/+$/, "") || "/";
      
    const protectedRoute =
      pathname === "/profile" ||
      pathname === "/profile/followers" ||
      pathname === "/profile/following" ||
      pathname === "/profile/blocked" ||
      pathname === "/home" ||
      pathname === "/create" ||
      pathname === "/library" ||
      pathname.startsWith("/edit/");

    const token = localStorage.getItem("token");

    if (protectedRoute && !token) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Inkwell — Write. Share. Inspire." },
      {
        name: "description",
        content:
          "A modern blogging platform built for developers, creators and writers. Publish beautifully and reach an audience that reads.",
      },
      { property: "og:title", content: "Inkwell — Write. Share. Inspire." },
      {
        property: "og:description",
        content:
          "A modern blogging platform built for developers, creators and writers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "/site.webmanifest" },
      { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />

      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "!bg-popover !text-popover-foreground !border-border !shadow-floating !rounded-xl",
          },
        }}
      />
    </QueryClientProvider>
  );
}