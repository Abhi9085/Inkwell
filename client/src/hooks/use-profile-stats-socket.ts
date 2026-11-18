import { useEffect, useState } from "react";

import { connectSocket, socket } from "@/lib/socket";

export type ProfileStats = {
  userId: number;
  posts: number;
  followers: number;
  following: number;
  views: number;
  likes: number;
  updatedAt?: string;
};

export function useProfileStatsSocket(userId: number | null) {
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      return;
    }

    let active = true;

    const joinProfileRoom = () => {
      socket.emit(
        "profile:join",
        userId,
        (ack: { ok: boolean; error?: string }) => {
          if (!active) return;

          if (!ack?.ok) {
            console.error(
              "Profile room subscription failed:",
              ack?.error
            );
          }
        }
      );
    };

    const handleStatsUpdate = (payload: ProfileStats) => {
      if (!active) return;

      // Ignore statistics belonging to another profile.
      if (Number(payload.userId) !== Number(userId)) return;

      setStats(payload);
    };

    socket.on("connect", joinProfileRoom);
    socket.on("profile:stats-updated", handleStatsUpdate);

    connectSocket();

    // Handle an already-connected socket.
    if (socket.connected) {
      joinProfileRoom();
    }

    return () => {
      active = false;
      
      socket.off("connect", joinProfileRoom);
      socket.off("profile:stats-updated", handleStatsUpdate);
    };
  }, [userId]);

  return stats;
}