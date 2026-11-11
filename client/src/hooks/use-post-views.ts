
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

interface UsePostViewsProps {
  postId: number;
  initialViews?: number;
}

export function usePostViews({
  postId,
  initialViews = 0,
}: UsePostViewsProps) {
  const [viewCount, setViewCount] = useState(initialViews);
  const viewTracked = useRef<number | null>(null);

  useEffect(() => {
    if (viewTracked.current === postId) return;

    viewTracked.current = postId;
    let cancelled = false;

    const trackView = async () => {
      try {
        const response = await api.post(`/posts/${postId}/view`);

        if (!cancelled) {
          setViewCount(response.data.views);
        }
      } catch (error) {
        console.error("Failed to track post view:", error);
      }
    };

    trackView();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  return {
    viewCount,
  };
}
