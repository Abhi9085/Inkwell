import { createFileRoute, notFound } from "@tanstack/react-router";

import api from "@/lib/api";
import type { Post } from "@/lib/types";

import { PostEditor } from "./create";

export const Route = createFileRoute("/edit/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    try {
      const response = await api.get(
        `/posts/edit/${encodeURIComponent(params.slug)}`
      );

      if (!response.data) {
        throw notFound();
      }

      return response.data as Post;
    } catch (error) {
      console.error("Failed to load post:", error);
      throw notFound();
    }
  },

  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            {
              title: `Edit · ${loaderData.title} — Inkwell`,
            },
          ],
        }
      : {
          meta: [{ title: "Not found" }],
        },

  component: EditPage,
});

function EditPage() {
  const post = Route.useLoaderData();

  return (
    <PostEditor
      mode="edit"
      postId={post.id}
      initial={{
        title: post.title,
        body: post.content,
        cover: post.cover,
        category: post.category,
        status: post.status,
        slug: post.slug,
        tags: post.tags ?? [],
      }}
      lastSavedAt="Recently"
    />
  );
}