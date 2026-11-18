
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  UserPlus,
} from "lucide-react";

import { Navbar } from "@/components/navbar";
import api from "@/lib/api";
import type { Notification } from "@/lib/types";
import { connectSocket, socket } from "@/lib/socket";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Inkwell" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [followingIds, setFollowingIds] = useState<number[]>([]);
  const [followLoadingId, setFollowLoadingId] = useState<number | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get("/notifications");

      setNotifications(response.data.notifications ?? []);
      setUnreadCount(response.data.unreadCount ?? 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch logged-in user
  useEffect(() => {
    let active = true;

    const fetchUser = async () => {
      try {
        const response = await api.get("/auth/me");

        if (active) {
          setUser(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);

        if (active) {
          navigate({ to: "/login" });
        }
      }
    };

    void fetchUser();

    return () => {
      active = false;
    };
  }, [navigate]);

  // Real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const joinUserRoom = () => {
      socket.emit(
        "user:join",
        user.id,
        (ack: { ok: boolean; error?: string }) => {
          if (!active) return;

          if (!ack?.ok) {
            console.error("Failed to join notification room:", ack?.error);
            return;
          }

          void fetchNotifications();
        }
      );
    };

    const handleNewNotification = () => {
      if (active) void fetchNotifications();
    };

    socket.on("connect", joinUserRoom);
    socket.on("notification:new", handleNewNotification);

    connectSocket();

    if (socket.connected) joinUserRoom();

    return () => {
      active = false;
      socket.off("connect", joinUserRoom);
      socket.off("notification:new", handleNewNotification);
    };
  }, [user?.id, fetchNotifications]);

  // Check which notification actors we already follow
  useEffect(() => {
    const actorIds = [
      ...new Set(
        notifications
          .filter(
            (notification) =>
              notification.type === "follow" && notification.actor_id
          )
          .map((notification) => notification.actor_id!)
      ),
    ];
  
    if (actorIds.length === 0) {
      setFollowingIds([]);
      return;
    }
  
    let active = true;
  
    const checkFollowing = async () => {
      const results = await Promise.all(
        actorIds.map(async (id) => {
          try {
            const response = await api.get(`/users/${id}/follow`);
            return response.data.following ? id : null;
          } catch {
            return null;
          }
        })
      );
  
      if (active) {
        setFollowingIds(results.filter((id): id is number => id !== null));
      }
    };
  
    void checkFollowing();
  
    return () => {
      active = false;
    };
  }, [notifications]);

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, is_read: true }
            : notification
        )
      );

      setUnreadCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(0);
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleFollowBack = async (actorId: number) => {
    if (followingIds.includes(actorId) || followLoadingId !== null) {
      return;
    }
  
    setFollowLoadingId(actorId);
  
    try {
      await api.post(`/users/${actorId}/follow`);
  
      setFollowingIds((current) => [...current, actorId]);
    } catch (error) {
      console.error("Follow back failed:", error);
    } finally {
      setFollowLoadingId(null);
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    try {
      await api.post(`/follow-requests/${requestId}/accept`);
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to accept follow request:", error);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      await api.post(`/follow-requests/${requestId}/reject`);
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to reject follow request:", error);
    }
  };

  const handleNotificationClick = async (
    notification: Notification
  ) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (
      (notification.type === "follow" || notification.type === "follow_request") 
      && notification.actor_id
    ) {
      navigate({
        to: "/profile/user/$id",
        params: { id: String(notification.actor_id) },
      });
    } else if (notification.post_slug) {
      navigate({
        to: "/posts/$slug",
        params: { slug: notification.post_slug },
      });
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter(
        (notification) => !notification.is_read
      );
    }

    return notifications;
  }, [notifications, filter]);

  const getNotificationDetails = (type: Notification["type"]) => {
    switch (type) {
      case "follow":
        return {
          icon: UserPlus,
          message: "started following you",
        };
      case "like":
        return {
          icon: Heart,
          message: "liked your story",
        };
      case "comment":
        return {
          icon: MessageCircle,
          message: "commented on your story",
        };
      case "follow_request":
        return {
          icon: UserPlus,
          message: "requested to follow you",
        };
      default:
        return {
          icon: Bell,
          message: "sent you a notification",
        };
    }
  };

  return (
    <>
      <Navbar variant="app" />

      <main className="container-page min-h-screen py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Notifications
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Stay updated with what's happening around you.
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <CheckCheck size={16} />
                Mark all as read
              </button>
            )}
          </div>

          <div className="mb-5 flex items-center gap-2 border-b">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                filter === "all"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                filter === "unread"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border">
            {isLoading ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                Loading notifications...
              </p>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <div className="rounded-full bg-secondary p-4">
                  <Bell size={28} className="text-muted-foreground" />
                </div>

                <h2 className="font-semibold">
                  {filter === "unread"
                    ? "You're all caught up!"
                    : "No notifications yet"}
                </h2>

                <p className="max-w-sm text-sm text-muted-foreground">
                  {filter === "unread"
                    ? "You don't have any unread notifications."
                    : "When someone follows you, likes your story, or comments, you'll see it here."}
                </p>
              </div>
            ) : (
                filteredNotifications.map((notification) => {
                  const details = getNotificationDetails(notification.type);
                  const Icon = details.icon;
                  const isFollowing =
                    notification.actor_id !== null &&
                    followingIds.includes(notification.actor_id);
                
                  return (
                    <div
                      key={notification.id}
                      className={`flex items-center gap-4 border-b p-5 last:border-b-0 hover:bg-secondary/50 ${
                        notification.is_read ? "" : "bg-secondary/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void handleNotificationClick(notification)}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <div className="relative shrink-0">
                          {notification.actor_avatar ? (
                            <img
                              src={notification.actor_avatar}
                              alt=""
                              className="h-11 w-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary font-semibold">
                              {(notification.actor_name ?? "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border bg-background">
                            <Icon size={11} />
                          </span>
                        </div>
                      
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-semibold">
                              {notification.actor_name ?? "Someone"}
                            </span>{" "}
                            {details.message}
                          </p>
                      
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                      
                        {!notification.is_read && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </button>
                    
                      {notification.type === "follow" &&
                        notification.actor_id !== null && (
                          <button
                            type="button"
                            disabled={isFollowing || followLoadingId !== null}
                            onClick={() =>
                              void handleFollowBack(notification.actor_id!)
                            }
                            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {followLoadingId === notification.actor_id
                              ? "Following..."
                              : isFollowing
                                ? "Following"
                                : "Follow Back"}
                          </button>
                        )}
                    {notification.type === "follow_request" &&
                      notification.follow_request_id !== null &&
                      notification.follow_request_status === "pending" && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void handleAcceptRequest(notification.follow_request_id!)
                            }
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                          >
                            Accept
                          </button>
                          
                          <button
                            type="button"
                            onClick={() =>
                              void handleRejectRequest(notification.follow_request_id!)
                            }
                            className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-secondary"
                          >
                            Reject
                          </button>
                        </div>
                      )
                    }
                    {notification.type === "follow_request" &&
                      notification.follow_request_status === "accepted" && (
                        <span className="shrink-0 text-xs font-medium text-green-600">
                          Accepted
                        </span>
                      )
                    }
                    {notification.type === "follow_request" &&
                      notification.follow_request_status === "rejected" && (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          Rejected
                        </span>
                      )
                    }
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </main>
    </>
  );
}
