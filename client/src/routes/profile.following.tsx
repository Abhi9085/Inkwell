import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import type { UserSummary } from "@/lib/types";
import { useFollowListSocket } from "@/hooks/use-follow-list-socket";

export const Route = createFileRoute("/profile/following")({
  component: FollowersPage,
});

function FollowersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useFollowListSocket(currentUserId, "following", setUsers);

  useEffect(() => {
    const loadFollowers = async () => {
      try {
        const me = await api.get("/auth/me");

        const response = await api.get(
          `/users/${me.data.id}/following`
        );

        setUsers(response.data);
        setCurrentUserId(Number(me.data.id));
      } catch (error) {
        console.error("Failed to load followers:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFollowers();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <div className="container-page py-10">
        <Link
          to="/profile"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight">
          Following
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          People you follow 
        </p>

        <div className="mt-8 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading following...
            </p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You aren't following anyone yet.
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
              >
                <Link
                  to="/profile/user/$id"
                  params={{ id: String(user.id) }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <img
                    src={
                      user.avatar ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                    }
                    alt={user.name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
          
                  <div className="min-w-0">
                    <p className="font-medium">{user.name}</p>
                  
                    <p className="text-sm text-muted-foreground">
                      @{user.handle}
                    </p>
                  
                    {user.bio && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </Link>
                  
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.delete(`/users/${user.id}/follow`);
                    
                      setUsers((currentUsers) =>
                        currentUsers.filter(
                          (currentUser) => currentUser.id !== user.id
                        )
                      );
                    } catch (error) {
                      console.error("Failed to unfollow user:", error);
                    }
                  }}
                  className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  Unfollow
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}