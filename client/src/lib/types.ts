export type Author = {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  bio: string;
  role: string;
};

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover: string | null;
  category: string;
  tags: string[];
  readingTime: number;
  likedByMe?: boolean;
  likes: number;
  views: number;
  featured: boolean;
  trending: boolean;
  status: "Draft" | "Public";
  publishedAt: string | null;
  createdAt: string;
  author: Author;
};

export type Comment = {
  id: number;
  postId: number;
  parentCommentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    name: string;
    handle: string;
    avatar: string | null;
  };
  replies: Comment[];
};

export type User = {
  id: number;
  name: string;
  handle: string;
  email: string;
  avatar: string | null;
  bio: string;
  role: string;
  followersCount: number;
};

export type UserSummary = {
  id: number;
  name: string;
  handle: string;
  avatar: string | null;
  bio: string;
};

export type Notification = {
  id: number;
  type: "follow" | "like" | "comment" | "follow_request";
  post_id: number | null;
  post_slug: string | null;
  comment_id: number | null;
  is_read: boolean;
  created_at: string;
  actor_id: number | null;
  actor_name: string | null;
  actor_handle: string | null;
  actor_avatar: string | null;
  follow_request_id: number | null;
  follow_request_status: "pending" | "accepted" | "rejected" | null;
};