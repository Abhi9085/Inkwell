import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Comment } from "@/lib/types";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";

export function usePostComments(postId: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      setCommentLoading(true);
      try {
        const response = await api.get<Comment[]>(`/posts/${postId}/comments`);
        if (cancelled) return;

        const topLevelComments = response.data;
        setComments(topLevelComments);
        // The API returns top-level comments with replies nested. Replies do not
        // contribute to the displayed comment count.
        setCommentsCount(topLevelComments.length);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load comments:", error);
        }
      } finally {
        if (!cancelled) setCommentLoading(false);
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const response = await api.get("/auth/me");
        if (!cancelled) setCurrentUserId(Number(response.data.id));
      } catch {
        if (!cancelled) setCurrentUserId(null);
      }
    };

    loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentText.trim();

    if (!content) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      setCommentSubmitting(true);
      const response = await api.post(`/posts/${postId}/comments`, { content });
      const newComment: Comment = {
        ...response.data,
        replies: response.data.replies ?? [],
      };

      setComments((previous) =>
        previous.some((comment) => comment.id === newComment.id)
          ? previous
          : [newComment, ...previous]
      );
      setCommentsCount((count) => count + 1);
      setCommentText("");
      toast.success("Comment added");
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Please login to comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleAddReply = async (
    event: FormEvent<HTMLFormElement>,
    parentCommentId: number
  ) => {
    event.preventDefault();
    const content = replyText.trim();

    if (!content) {
      toast.error("Reply cannot be empty");
      return;
    }

    try {
      setReplySubmitting(true);
      const response = await api.post(`/posts/${postId}/comments`, {
        content,
        parentCommentId,
      });
      const newReply: Comment = { ...response.data, replies: [] };

      setComments((previous) =>
        previous.map((comment) => {
          if (comment.id !== parentCommentId) return comment;
          if (comment.replies?.some((reply) => reply.id === newReply.id)) {
            return comment;
          }
          return {
            ...comment,
            replies: [...(comment.replies ?? []), newReply],
          };
        })
      );

      // Replies are intentionally excluded from commentsCount.
      setReplyText("");
      setReplyingToId(null);
      toast.success("Reply added");
    } catch (error) {
      console.error("Failed to add reply:", error);
      toast.error("Please login to reply");
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleEditComment = async (
    event: FormEvent<HTMLFormElement>,
    commentId: number
  ) => {
    event.preventDefault();
    const content = editingCommentText.trim();

    if (!content) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      setSavingEdit(true);
      const response = await api.patch(`/posts/comments/${commentId}`, { content });
      const updatedComment = response.data as Partial<Comment>;

      setComments((previous) =>
        previous.map((comment) => {
          if (comment.id === commentId) {
            return { ...comment, ...updatedComment };
          }
          return {
            ...comment,
            replies: (comment.replies ?? []).map((reply) =>
              reply.id === commentId ? { ...reply, ...updatedComment } : reply
            ),
          };
        })
      );

      setEditingCommentId(null);
      setEditingCommentText("");
      toast.success("Comment updated");
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error("Could not update comment");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (
    commentId: number,
    parentCommentId: number | null
  ) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    try {
      setDeletingCommentId(commentId);
      const response = await api.delete(`/posts/comments/${commentId}`);

      setComments((previous) => {
        if (parentCommentId === null) {
          return previous.filter((comment) => comment.id !== commentId);
        }
        return previous.map((comment) => ({
          ...comment,
          replies: (comment.replies ?? []).filter((reply) => reply.id !== commentId),
        }));
      });

      if (typeof response.data.commentsCount === "number") {
        setCommentsCount(response.data.commentsCount);
      } else if (parentCommentId === null) {
        setCommentsCount((count) => Math.max(0, count - 1));
      }

      toast.success("Comment deleted");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Could not delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  };

  return {
    comments,
    setComments,
    commentsCount,
    setCommentsCount,
    commentText,
    setCommentText,
    commentLoading,
    commentSubmitting,
    currentUserId,
    deletingCommentId,
    replyingToId,
    setReplyingToId,
    replyText,
    setReplyText,
    replySubmitting,
    editingCommentId,
    setEditingCommentId,
    editingCommentText,
    setEditingCommentText,
    savingEdit,
    visibleReplies,
    setVisibleReplies,
    handleAddComment,
    handleAddReply,
    handleEditComment,
    handleDeleteComment,
  };
}
