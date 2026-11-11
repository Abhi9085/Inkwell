
import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface UsePostFollowProps {
  authorId: number;
}

export function usePostFollow({ authorId }: UsePostFollowProps) {
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [requestPending, setRequestPending] = useState(false);

  // Load follow status
  useEffect(() => {
    let cancelled = false;

    const loadFollowStatus = async () => {
      try {
        const response = await api.get(`/users/${authorId}/follow`);

        if (cancelled) return;

        setFollowing(response.data.following);
        setFollowersCount(response.data.followersCount);
        setRequestPending(response.data.requestPending ?? false);
      } catch (error) {
        console.error("Failed to load follow status:", error);
      }
    };

    loadFollowStatus();

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  const handleFollow = async () => {
    if (isFollowing || requestPending) return;

    const wasFollowing = following;
    setIsFollowing(true);

    try {
      const response = wasFollowing
        ? await api.delete(`/users/${authorId}/follow`)
        : await api.post(`/users/${authorId}/follow`);

      const nowFollowing = response.data.following === true;
      const nowRequestPending = response.data.requestPending === true;

      setFollowing(nowFollowing);
      setRequestPending(nowRequestPending);
      setFollowersCount(response.data.followersCount);

      window.dispatchEvent(
        new CustomEvent("follow-updated", {
          detail: {
            followersCount: response.data.followersCount,
          },
        })
      );

      if (wasFollowing) {
        toast.success("Unfollowed author");
      } else if (nowRequestPending) {
        toast.success("Follow request sent");
      } else if (nowFollowing) {
        toast.success("Following author");
      }
    } catch (error: any) {
      console.error("Follow error:", error);

      toast.error(
        error?.response?.data?.error || "Failed to update follow"
      );
    } finally {
      setIsFollowing(false);
    }
  };

  return {
    following,
    requestPending,
    followersCount,
    isFollowing,
    handleFollow,
  };
}
