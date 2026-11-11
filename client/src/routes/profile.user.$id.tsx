import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  X,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { PostCard } from "@/components/post-card";
import api from "@/lib/api";
import type { Post, UserSummary } from "@/lib/types";
import { useProfileStatsSocket } from "@/hooks/use-profile-stats-socket";
import { connectSocket, socket } from "@/lib/socket";
type PublicUser = UserSummary & {
  cover: string | null;
  role: string;
  followersCount: number;
  followingCount: number;
  is_private: boolean;
};
export const Route = createFileRoute("/profile/user/$id")({
  component: PublicProfilePage,
});
function PublicProfilePage() {
  const { id } = Route.useParams();
  const profileStats = useProfileStatsSocket(Number(id));
  const [user, setUser] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "likes">("posts");
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const userId = Number(id);
        setActiveTab("posts");
        setLikedPosts([]);
        setPosts([]);
        setFollowing(false);
        setRequestPending(false);

        const userResponse = await api.get(`/users/${userId}`);
        const profileUser = userResponse.data as PublicUser;
        setUser(profileUser);
        setIsPrivate(Boolean(profileUser.is_private));

        let viewerId: number | null = null;
        try {
          const meResponse = await api.get("/auth/me");
          viewerId = Number(meResponse.data.id);
          setCurrentUserId(viewerId);
        } catch {
          setCurrentUserId(null);
        }

        const isOwner = viewerId === userId;
        let viewerFollows = false;

        if (viewerId && !isOwner) {
          try {
            const followResponse = await api.get(`/users/${userId}/follow`);
            viewerFollows = Boolean(followResponse.data.following);
            setFollowing(viewerFollows);
            setRequestPending(Boolean(followResponse.data.requestPending));
            setIsPrivate(Boolean(followResponse.data.isPrivate));
          } catch (error) {
            // A blocked profile is intentionally treated as unavailable.
            throw error;
          }
        }

        // Do not request posts from a private profile unless this is its owner
        // or the logged-in viewer has an accepted follow relationship.
        if (!profileUser.is_private || isOwner || viewerFollows) {
          const postsResponse = await api.get(`/users/${userId}/posts`);
          setPosts(postsResponse.data);
        }

        if (isOwner) {
          try {
            const likedPostsResponse = await api.get(`/users/${userId}/liked-posts`);
            setLikedPosts(likedPostsResponse.data);
          } catch (error) {
            console.error("Failed to load liked posts:", error);
            setLikedPosts([]);
          }
        }
      } catch (error) {
        console.error("Failed to load public profile:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [id]);
  useEffect(() => {
    const handleFollowRequestUpdate = (payload: {
      requestId: number;
      status: "accepted" | "rejected";
      following: boolean;
    }) => {
      setFollowing(payload.following);
      setRequestPending(false);
      if (payload.status === "accepted") {
        toast.success("Your follow request was accepted!");
      } else if (payload.status === "rejected") {
        toast.info("Your follow request was rejected.");
      }
    };
    socket.on("follow-request:updated", handleFollowRequestUpdate);
    connectSocket();
    return () => {
      socket.off("follow-request:updated", handleFollowRequestUpdate);
    };
  }, []);
  const handleFollow = async () => {
    if (!user) return;
    if (!currentUserId) {
      toast.error("Please log in to follow users");
      return;
    }
    if (currentUserId === user.id) return;
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        const response = await api.delete(
          `/users/${user.id}/follow`
        );
        setFollowing(false);
        setUser((currentUser) =>
          currentUser
            ? {
                ...currentUser,
                followersCount: response.data.followersCount,
              }
            : currentUser
        );
      } else {
        const response = await api.post(
          `/users/${user.id}/follow`
        );
        setFollowing(response.data.following);
        setRequestPending(response.data.requestPending);
        setUser((currentUser) =>
          currentUser
            ? {
                ...currentUser,
                followersCount: response.data.followersCount,
              }
            : currentUser
        );
      }
    } catch (error: any) {
      console.error("Follow error:", error);
      toast.error(
        error.response?.data?.error || "Failed to update follow"
      );
    } finally {
      setFollowLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar variant="app" />
        <div className="container-page py-10">
          <p className="text-sm text-muted-foreground">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar variant="app" />
        <div className="container-page py-10">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
          <h1 className="mt-8 text-2xl font-semibold">
            User not found
          </h1>
        </div>
      </div>
    );
  }
  const isOwnProfile = currentUserId === user.id;
  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />
      <div className="relative h-56 overflow-hidden bg-secondary md:h-72">
        <img
          src={
            user.cover ||
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1800&q=80"
          }
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-background/10 to-transparent" />
      </div>
      <div className="container-page relative z-10">
        <div className="-mt-16 flex flex-col gap-6 md:-mt-20 md:flex-row md:items-end">
          <img
            src={
              user.avatar ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
            }
            alt={user.name}
            className="h-32 w-32 shrink-0 rounded-2xl border-4 border-background bg-background object-cover shadow-elevated md:h-40 md:w-40"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {user.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{user.handle}
            </p>
            <p className="mt-3 max-w-2xl text-[15px] text-foreground/90">
              {user.bio || "Writer and creator on Inkwell."}
            </p>
          </div>
          {!isOwnProfile && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={followLoading || requestPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {following ? (
                <>
                  <UserMinus className="h-4 w-4" />
                  {followLoading ? "Updating..." : "Unfollow"}
                </>
              ) : requestPending ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  Request sent
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {followLoading ? "Updating..." : "Follow"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="container-page mt-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            {
              label: "Posts",
              value: profileStats?.posts ?? posts.length,
            },
            {
              label: "Followers",
              value:
                profileStats?.followers ?? user.followersCount,
            },
            {
              label: "Following",
              value:
                profileStats?.following ?? user.followingCount,
            },
            {
              label: "Views",
              value:
                profileStats?.views ??
                posts.reduce(
                  (total, post) => total + (post.views || 0),
                  0
                ),
            },
            {
              label: "Likes",
              value:
                profileStats?.likes ??
                posts.reduce(
                  (total, post) => total + (post.likes || 0),
                  0
                ),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <p className="text-xs text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="container-page mt-10">
        <div className="flex gap-8 border-b border-border">
          {(["posts", ...(isOwnProfile ? (["likes"] as const) : [])] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="container-page mt-8 pb-24">
        {activeTab === "posts" && (
          <section>
            {isPrivate && !isOwnProfile && !following ? (
              <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
                <p className="text-sm font-medium">This account is private.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Follow this account to see its published stories.
                </p>
              </div>
            ) : posts.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
                <p className="text-sm font-medium">No published stories yet.</p>
              </div>
            ) : (
              <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        )}
        {isOwnProfile && activeTab === "likes" && (
          <section>
            <h2 className="text-xl font-semibold mb-6">
              Liked stories
            </h2>
            {likedPosts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>No liked stories yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {likedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}