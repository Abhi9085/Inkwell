
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface UsePostLikesProps {
  postId: number;
  initialLiked?: boolean;
  initialLikes?: number;
}

export function usePostLikes({
  postId,
  initialLiked = false,
  initialLikes = 0,
}: UsePostLikesProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [isLiking, setIsLiking] = useState(false);

  const isLikingRef = useRef(false);
  const currentPostIdRef = useRef(postId);

  currentPostIdRef.current = postId;

  useEffect(() => {
    let cancelled = false;

    setLiked(initialLiked);
    setLikesCount(initialLikes);

    const loadLikeStatus = async () => {
      try {
        const response = await api.get(`/posts/${postId}/like-status`);

        if (cancelled) return;

        setLiked(response.data.liked);
        setLikesCount(response.data.likes);
      } catch (error) {
        console.error("Failed to load like status:", error);
      }
    };

    loadLikeStatus();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleLike = async () => {
    if (isLikingRef.current) return;

    const targetPostId = postId;
    const previousLiked = liked;
    const previousCount = likesCount;
    const nextLiked = !previousLiked;

    isLikingRef.current = true;
    setIsLiking(true);

    setLiked(nextLiked);
    setLikesCount(
      Math.max(0, previousCount + (nextLiked ? 1 : -1))
    );

    try {
      const response = nextLiked
        ? await api.post(`/posts/${targetPostId}/like`)
        : await api.delete(`/posts/${targetPostId}/like`);

      if (currentPostIdRef.current !== targetPostId) return;

      setLiked(response.data.liked);
      setLikesCount(response.data.likes);
    } catch (error: any) {
      if (currentPostIdRef.current === targetPostId) {
        setLiked(previousLiked);
        setLikesCount(previousCount);
      }

      console.error("Like error:", error);

      if (error.response?.status === 401) {
        toast.error("Please log in to like this post.");
      } else if (error.response?.status === 403) {
        toast.error(
          error.response.data.error || "You cannot like your own post."
        );
      } else {
        toast.error("Unable to update your like. Please try again.");
      }
    } finally {
      isLikingRef.current = false;

      if (currentPostIdRef.current === targetPostId) {
        setIsLiking(false);
      }
    }
  };

  return {
    liked,
    likesCount,
    isLiking,
    setLikesCount,
    handleLike,
  };
}
