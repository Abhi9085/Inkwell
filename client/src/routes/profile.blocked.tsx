import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldBan, UserRoundX } from "lucide-react";
import { toast } from "sonner";

import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import type { UserSummary } from "@/lib/types";

export const Route = createFileRoute("/profile/blocked")({
  head: () => ({ meta: [{ title: "Blocked accounts — Inkwell" }] }),
  component: BlockedUsersPage,
});

function BlockedUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        const response = await api.get("/users/blocked");
        setUsers(response.data);
      } catch (error: any) {
        console.error("Failed to load blocked users:", error);
        toast.error(
          error.response?.data?.error || "Failed to load blocked accounts"
        );
      } finally {
        setLoading(false);
      }
    };

    loadBlockedUsers();
  }, []);

  const handleUnblock = async (user: UserSummary) => {
    if (unblockingId !== null) return;

    setUnblockingId(user.id);

    try {
      await api.delete(`/users/${user.id}/block`);

      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== user.id)
      );

      toast.success(`${user.name} has been unblocked`);
    } catch (error: any) {
      console.error("Failed to unblock user:", error);
      toast.error(error.response?.data?.error || "Failed to unblock user");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      <main className="container-page py-10">
        <Link
          to="/profile"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>

        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary">
            <ShieldBan className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Blocked accounts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the people you've blocked on Inkwell.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary">
              <UserRoundX className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">
              You haven't blocked anyone
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Accounts you block will appear here. You can unblock them at any
              time.
            </p>
            <Link
              to="/home"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Back to feed
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-8 text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? "blocked account" : "blocked accounts"}
            </p>

            <div className="mt-4 space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <img
                      src={
                        user.avatar ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`
                      }
                      alt={user.name}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />

                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        @{user.handle}
                      </p>
                      {user.bio && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(user)}
                    disabled={unblockingId !== null}
                    className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {unblockingId === user.id ? "Unblocking..." : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
