import { useProfileStatsSocket } from "@/hooks/use-profile-stats-socket";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Calendar,
  Image as ImageIcon,
  Pencil,
  ShieldBan,
  Trash2,
  X,
} from "lucide-react";

import {
  GoogleOAuthProvider,
  GoogleLogin,
  type CredentialResponse,
} from "@react-oauth/google";

import { toast } from "sonner";

import { Navbar } from "@/components/navbar";
import { PostCard } from "@/components/post-card";
import api from "@/lib/api";
import type { Post } from "@/lib/types";

export const Route = createFileRoute("/profile/")({
  head: () => ({ meta: [{ title: "Profile — Inkwell" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "likes">("posts");
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editBio, setEditBio] = useState("");

  const [isPrivate, setIsPrivate] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [googleCredential, setGoogleCredential] = useState("");

  const profileStats = useProfileStatsSocket(
    user?.id ? Number(user.id) : null
  );

  // ------------------------------------------
  // Fetch profile + user's posts
  // ------------------------------------------
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // First, verify the logged-in user.
        const userResponse = await api.get("/auth/me");
        setUser(userResponse.data);
      
        // Fetch posts separately so a posts API failure
        // doesn't make the entire profile appear unauthenticated.
        try {
          const postsResponse = await api.get("/posts/mine");
          setMyPosts(postsResponse.data);
        } catch (error) {
          console.error("Failed to load posts:", error);
          toast.error("Failed to load your posts.");
        }
      
        // Fetch the user's private liked posts.
        setIsLoadingLikes(true);
      
        try {
          const likesResponse = await api.get(
            `/users/${userResponse.data.id}/liked-posts`
          );
          setLikedPosts(likesResponse.data);
        } catch (error) {
          console.error("Failed to load liked posts:", error);
          setLikedPosts([]);
        } finally {
          setIsLoadingLikes(false);
        }
      } catch (error: any) {
        console.error("Failed to load profile:", error);
      
        if (
          [401, 403, 404].includes(error.response?.status)
        ) {
          setProfileError("Please log in to access your profile.");
        } else {
          setProfileError("Unable to load your profile. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchProfile();
  }, []);

  // ------------------------------------------
  // Keep follower count in sync
  // ------------------------------------------
  useEffect(() => {
    const handleFollowUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ followersCount: number }>;

      setUser((currentUser: any) => {
        if (!currentUser) return currentUser;

        return {
          ...currentUser,
          followersCount: customEvent.detail.followersCount,
        };
      });
    };

    window.addEventListener("follow-updated", handleFollowUpdate);

    return () => {
      window.removeEventListener("follow-updated", handleFollowUpdate);
    };
  }, []);

  // ------------------------------------------
  // Open edit profile
  // ------------------------------------------
  const openEditProfile = () => {
    setEditName(profileData.name || "");
    setEditHandle(profileData.handle || "");
    setEditBio(profileData.bio || "");

    setIsPrivate(profileData.is_private ?? false);

    setAvatarFile(null);
    setCoverFile(null);
    setAvatarPreview(profileData.avatar || null);
    setCoverPreview(profileData.cover || null);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }

    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }

    setIsEditOpen(true);
  };

  // ------------------------------------------
  // Close edit profile
  // ------------------------------------------
  const closeEditProfile = () => {
    if (isSavingProfile) return;

    setIsEditOpen(false);
    setAvatarFile(null);
    setCoverFile(null);
    setAvatarPreview(null);
    setCoverPreview(null);
  };

  // ------------------------------------------
  // Save user profile
  // ------------------------------------------
  const handleSaveProfile = async () => {
    if (!editName.trim() || !editHandle.trim()) {
      toast.error("Name and handle are required");
      return;
    }

    setIsSavingProfile(true);

    try {
      const formData = new FormData();

      formData.append("name", editName.trim());
      formData.append("handle", editHandle.trim());
      formData.append("bio", editBio.trim());
      formData.append("is_private", String(isPrivate));

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      if (coverFile) {
        formData.append("cover", coverFile);
      }

      const response = await api.put("/auth/profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedUser = response.data;

      setUser(updatedUser);

      localStorage.setItem("user", JSON.stringify(updatedUser));

      setAvatarFile(null);
      setCoverFile(null);
      setAvatarPreview(null);
      setCoverPreview(null);
      setIsEditOpen(false);

      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: updatedUser,
        })
      );

      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Update profile error:", error);

      toast.error(
        error.response?.data?.error || "Failed to update profile"
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ------------------------------------------
  // Validate image
  // ------------------------------------------
  const validateImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return false;
    }

    return true;
  };

  // ------------------------------------------
  // Avatar image
  // ------------------------------------------
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !validateImage(file)) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // ------------------------------------------
  // Cover image
  // ------------------------------------------
  const handleCoverChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !validateImage(file)) return;

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  // ------------------------------------------
  // Delete post
  // ------------------------------------------
  const handleDeletePost = async (postId: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this post?"
    );

    if (!confirmed) return;
    if (deletingPostId !== null) return;

    setDeletingPostId(postId);

    try {
      await api.delete(`/posts/${postId}`);

      setMyPosts((currentPosts) =>
        currentPosts.filter((post) => post.id !== postId)
      );

      toast.success("Post deleted successfully");
    } catch (error: any) {
      console.error("Delete post error:", error);

      toast.error(
        error.response?.data?.error || "Failed to delete post"
      );
    } finally {
      setDeletingPostId(null);
    }
  };


  const handleGoogleDeleteVerification = (
    credentialResponse: CredentialResponse
  ) => {
    if (!credentialResponse.credential) {
      toast.error("Google verification failed. Please try again.");
      return;
    }

    setGoogleCredential(credentialResponse.credential);
    toast.success("Google account verified. You can now confirm deletion.");
  };


  // ------------------------------------------
  // Delete Account
  // ------------------------------------------
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error('Please type DELETE to confirm.');
      return;
    }

    if (user?.has_password && !deletePassword) {
      toast.error("Please enter your current password.");
      return;
    }

    if (!user?.has_password && !googleCredential) {
      toast.error("Please verify your Google account first.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      const payload = user?.has_password
        ? {
            confirmation: "DELETE",
            password: deletePassword,
          }
        : {
            confirmation: "DELETE",
            googleCredential,
          };

      const response = await api.delete("/account", {
        data: payload,
      });

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      setShowDeleteAccount(false);

      if (response.data.cleanupPending) {
        toast.warning(
          "Your account was deleted, but some profile images may need cleanup."
        );
      } else {
        toast.success("Your account has been deleted.");
      }

      window.location.assign("/");
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Could not delete your account."
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Show loading screen while verifying the session.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">
          Loading your profile...
        </p>
      </div>
    );
  }
  
  // Show error screen if authentication or profile loading fails.
  if (profileError || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-2xl font-semibold">
          Profile unavailable
        </h1>
    
        <p className="text-sm text-muted-foreground">
          {profileError || "Please log in to access your profile."}
        </p>
    
        <button
          type="button"
          onClick={() => window.location.assign("/login")}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go to Login
        </button>
      </div>
    );
  }
  
  // Authenticated user data only.
  const profileData = user;

  const totalViews = myPosts.reduce(
    (total, post) => total + (post.views || 0),
    0
  );

  const totalLikes = myPosts.reduce(
    (total, post) => total + (post.likes || 0),
    0
  );

  const dynamicStats = [
    {
      label: "Posts",
      value: profileStats?.posts ?? myPosts.length,
    },
    {
      label: "Followers",
      value:
        profileStats?.followers ??
        profileData.followersCount ??
        0,
    },
    {
      label: "Following",
      value:
        profileStats?.following ??
        profileData.followingCount ??
        0,
    },
    {
      label: "Views",
      value: profileStats?.views ?? totalViews,
    },
    {
      label: "Likes",
      value: profileStats?.likes ?? totalLikes,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="app" />

      {/* Cover Image */}
      <div className="relative h-56 overflow-hidden bg-secondary md:h-72">
        <img
          src={
            profileData.cover ||
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1800&q=80"
          }
          alt=""
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-background/10 to-transparent" />
      </div>

      {/* Profile Details */}
      <div className="container-page relative z-10">
        <div className="-mt-16 flex flex-col gap-6 md:-mt-20 md:flex-row md:items-end">
          {/* Avatar */}
          <img
            src={
              profileData.avatar ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${profileData.name}`
            }
            alt={profileData.name}
            className="h-32 w-32 shrink-0 rounded-2xl border-4 border-background bg-background object-cover shadow-elevated md:h-40 md:w-40"
          />

          {/* User Info */}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {profileData.name}
            </h1>

            <p className="text-sm text-muted-foreground">
              @{profileData.handle || "username"}
            </p>

            <p className="mt-3 max-w-2xl text-[15px] text-foreground/90">
              {profileData.bio || "Passionate writer and creator on Inkwell."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined{" "}
                {new Date(profileData.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Edit Profile */}
          <div className="flex flex-wrap gap-2">
            <Link
              to="/profile/blocked"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
            >
              <ShieldBan className="h-4 w-4" />
              Blocked users
            </Link>

            <button
              type="button"
              onClick={openEditProfile}
              className="h-10 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
            >
              Edit profile
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="container-page mt-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {dynamicStats.map((stat) => {
            const isFollowers = stat.label === "Followers";
            const isFollowing = stat.label === "Following";
          
            const content = (
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
            
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {stat.value}
                </p>
              </div>
            );
          
            if (isFollowers) {
              return (
                <Link key={stat.label} to="/profile/followers">
                  {content}
                </Link>
              );
            }
          
            if (isFollowing) {
              return (
                <Link key={stat.label} to="/profile/following">
                  {content}
                </Link>
              );
            }
          
            return <div key={stat.label}>{content}</div>;
          })}
        </div>

        {/* Profile tabs */}
        <div className="mt-10 border-b border-border">
          <div className="flex gap-6 text-sm">
            {(["posts", "likes"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`-mb-px border-b-2 pb-3 font-medium capitalize ${
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        {activeTab === "posts" && (
        <div className="mt-8 grid gap-5 pb-24 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading your posts...
            </p>
          ) : myPosts.length > 0 ? (
            myPosts.map((post) => (
              <div key={post.id} className="group relative">
                <PostCard post={post} />

                {/* Action buttons */}
                <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Edit */}
                  <Link
                    to="/edit/$slug"
                    params={{ slug: post.slug }}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/95 shadow-soft backdrop-blur hover:bg-secondary"
                    aria-label="Edit post"
                    title="Edit post"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingPostId === post.id}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/95 text-destructive shadow-soft backdrop-blur hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Delete post"
                    title="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Draft badge */}
                {post.status === "Draft" && (
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                    Draft
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-surface p-12 text-center">
              <p className="text-sm font-medium text-foreground">
                You haven't written any stories yet.
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Head over to the editor to write your first post!
              </p>

              <Link
                to="/create"
                className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Create Post
              </Link>
            </div>
          )}
        </div>
        )}

        {/* Liked posts — visible only on the authenticated owner's profile. */}
        {activeTab === "likes" && (
          <div className="mt-8 grid gap-5 pb-24 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingLikes ? (
              <p className="col-span-full text-sm text-muted-foreground">
                Loading liked posts...
              </p>
            ) : likedPosts.length > 0 ? (
              likedPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
              <div className="col-span-full rounded-xl border border-dashed border-border bg-surface p-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  You haven't liked any posts yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Delete Account */}
        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your Inkwell account and associated content.
          </p>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmation("");
              setDeletePassword("");
              setShowDeleteAccount(true);
              setGoogleCredential("");
              setIsDeletingAccount(false);
            }}
            className="mt-4 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl"
          >
            <h2
              id="delete-account-title"
              className="text-xl font-semibold text-destructive"
            >
              Delete your account?
            </h2>
      
            <p className="mt-2 text-sm text-muted-foreground">
              This action is permanent. Your account and associated content will be
              deleted and cannot be recovered.
            </p>
      
            {user?.has_password ? (
              <div className="mt-5">
                <label
                  htmlFor="delete-account-password"
                  className="block text-sm font-medium"
                >
                  Current password
                </label>
                <input
                  id="delete-account-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your current password"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-red-500"
                />
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                <div className="mt-5">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Verify your Google account before deleting your account.
                  </p>

                  {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                    <GoogleOAuthProvider
                      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
                    >
                      <GoogleLogin
                        onSuccess={handleGoogleDeleteVerification}
                        onError={() => toast.error("Google verification failed.")}
                        theme="outline"
                        size="large"
                        shape="rectangular"
                        text="continue_with"
                        width="320"
                      />
                    </GoogleOAuthProvider>
                  ) : (
                    <p className="text-sm text-destructive">
                      Google sign-in is not configured.
                    </p>
                  )}

                  {googleCredential && (
                    <p className="mt-2 text-sm text-green-600">
                      Google verification received.
                    </p>
                  )}
                </div>
              </p>
            )}

            <div className="mt-5">
              <label
                htmlFor="delete-account-confirmation"
                className="block text-sm font-medium"
              >
                Type DELETE to confirm
              </label>
              <input
                id="delete-account-confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-red-500"
              />
            </div>
          
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccount(false);
                  setDeleteConfirmation("");
                  setDeletePassword("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={
                  isDeletingAccount ||
                  deleteConfirmation !== "DELETE" ||
                  (user?.has_password
                    ? !deletePassword
                    : !googleCredential)
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditProfile();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-elevated">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="edit-profile-title"
                  className="text-xl font-semibold"
                >
                  Edit profile
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update your public profile information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditProfile}
                disabled={isSavingProfile}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary disabled:opacity-50"
                aria-label="Close edit profile"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Avatar */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Profile photo
                </label>

                <div className="flex items-center gap-4">
                  <img
                    src={
                      avatarPreview ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${editName}`
                    }
                    alt="Profile preview"
                    className="h-20 w-20 rounded-2xl border border-border object-cover"
                  />

                  <div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />

                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Change photo
                    </button>

                    <p className="mt-1 text-xs text-muted-foreground">
                      JPG, PNG, WebP or GIF · Max 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Cover */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Cover image
                </label>

                <div className="overflow-hidden rounded-xl border border-border">
                  <img
                    src={
                      coverPreview ||
                      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1800&q=80"
                    }
                    alt="Cover preview"
                    className="h-36 w-full object-cover"
                  />

                  <div className="p-3">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleCoverChange}
                    />

                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Change cover
                    </button>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Recommended: wide landscape image · Max 5MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Name
                </label>

                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Your name"
                  maxLength={80}
                />
              </div>

              {/* Handle */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Handle
                </label>

                <input
                  value={editHandle}
                  onChange={(event) => setEditHandle(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="username"
                  maxLength={40}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Your handle must be unique.
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Bio
                </label>

                <textarea
                  value={editBio}
                  onChange={(event) => setEditBio(event.target.value)}
                  rows={4}
                  maxLength={300}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Tell people a little about yourself..."
                />

                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {editBio.length}/300
                </p>
              </div>
                                
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Private account</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only approved followers can follow your profile.
                  </p>
                </div>    
                <button
                  type="button"
                  role="switch"
                  aria-label="Private account"
                  aria-checked={isPrivate}
                  onClick={() => setIsPrivate((current) => !current)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isPrivate ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      isPrivate ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditProfile}
                disabled={isSavingProfile}
                className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProfile ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
