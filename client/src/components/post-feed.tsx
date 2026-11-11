import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PostCard } from "@/components/post-card";
import type { Post } from "@/lib/types";

export default function PostFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPosts = async () => {
      try {
        const response = await api.get<Post[]>("/posts");

        if (isMounted) {
          setPosts(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}