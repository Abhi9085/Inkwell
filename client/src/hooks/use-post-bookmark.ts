
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface UsePostBookmarkProps {
  postId: number;
}

export function usePostBookmark({ postId }: UsePostBookmarkProps) {
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load bookmark status
  useEffect(() => {
    let cancelled = false;

    const loadBookmarkStatus = async () => {
      try {
        const response = await api.get(`/posts/${postId}/bookmark`);

        if (!cancelled) {
          setSaved(response.data.saved);
        }
      } catch (error) {
        if (!cancelled) {
          // Not logged in = simply not saved
          setSaved(false);
        }
      }
    };

    loadBookmarkStatus();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Add or remove bookmark
  const handleBookmark = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      if (saved) {
        const response = await api.delete(`/posts/${postId}/bookmark`);

        setSaved(response.data.saved);
        toast.success("Removed from library");
      } else {
        const response = await api.post(`/posts/${postId}/bookmark`);

        setSaved(response.data.saved);
        toast.success("Saved to library");
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error("Please login to save this post");
      } else {
        toast.error("Failed to update library");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    saved,
    isSaving,
    handleBookmark,
  };
}
