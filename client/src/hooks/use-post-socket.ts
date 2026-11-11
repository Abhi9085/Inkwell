import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { connectSocket, socket } from "@/lib/socket";
import type { Comment } from "@/lib/types";

type LikeUpdate = {
  postId: number;
  likes: number;
};

type CommentCreated = {
  postId: number;
  comment: Comment;
  commentsCount: number;
};

type CommentUpdated = {
  postId: number;
  comment: Comment;
};

type CommentDeleted = {
  postId: number;
  commentId: number;
  parentCommentId: number | null;
  commentsCount: number;
};

type CommentsUpdated = {
  postId: number;
  commentsCount: number;
};

type UsePostSocketOptions = {
  postId: number;
  setLikesCount: Dispatch<SetStateAction<number>>;
  setComments: Dispatch<SetStateAction<Comment[]>>;
  setCommentsCount: Dispatch<SetStateAction<number>>;
};

export function usePostSocket({
  postId,
  setLikesCount,
  setComments,
  setCommentsCount,
}: UsePostSocketOptions) {
  useEffect(() => {
    const joinPostRoom = () => {
      console.log("[socket] Connected:", socket.id);
      console.log("[socket] Joining post room:", postId);
      socket.emit("post:join", postId);
    };

    const handleLikeUpdate = (data: LikeUpdate) => {
      if (Number(data.postId) !== postId) return;
      setLikesCount(Number(data.likes));
    };

    const handleConnectError = (error: Error) => {
      console.error("[socket] Connection error:", error.message);
    };

    const handleCommentCreated = (data: CommentCreated) => {
      if (Number(data.postId) !== postId) return;

      setComments((previous) => {
        const newComment = data.comment;
        const alreadyExists = previous.some(
          (comment) =>
            comment.id === newComment.id ||
            comment.replies?.some((reply) => reply.id === newComment.id)
        );
        if (alreadyExists) return previous;

        if (newComment.parentCommentId) {
          return previous.map((comment) =>
            comment.id === newComment.parentCommentId
              ? {
                  ...comment,
                  replies: [...(comment.replies ?? []), newComment],
                }
              : comment
          );
        }

        return [{ ...newComment, replies: newComment.replies ?? [] }, ...previous];
      });
    };

    const handleCommentUpdated = (data: CommentUpdated) => {
      if (Number(data.postId) !== postId) return;

      setComments((previous) =>
        previous.map((comment) => {
          if (comment.id === data.comment.id) {
            return { ...comment, ...data.comment };
          }
          return {
            ...comment,
            replies: (comment.replies ?? []).map((reply) =>
              reply.id === data.comment.id ? { ...reply, ...data.comment } : reply
            ),
          };
        })
      );
    };

    const handleCommentDeleted = (data: CommentDeleted) => {
      if (Number(data.postId) !== postId) return;

      setComments((previous) => {
        // Deleting a parent removes its nested replies too.
        if (data.parentCommentId === null) {
          return previous.filter((comment) => comment.id !== data.commentId);
        }
        return previous.map((comment) => ({
          ...comment,
          replies: (comment.replies ?? []).filter(
            (reply) => reply.id !== data.commentId
          ),
        }));
      });
      setCommentsCount(data.commentsCount);
    };

    const handleCommentsUpdated = (data: CommentsUpdated) => {
      if (Number(data.postId) !== postId) return;
      setCommentsCount(data.commentsCount);
    };

    socket.on("connect", joinPostRoom);
    socket.on("post:likes-updated", handleLikeUpdate);
    socket.on("connect_error", handleConnectError);
    socket.on("post:comment-created", handleCommentCreated);
    socket.on("post:comment-updated", handleCommentUpdated);
    socket.on("post:comment-deleted", handleCommentDeleted);
    socket.on("post:comments-updated", handleCommentsUpdated);

    connectSocket();

    if (socket.connected) {
      joinPostRoom();
    }

    return () => {
      // Leave only this room. This socket is shared by the application.
      if (socket.connected) socket.emit("post:leave", postId);

      socket.off("connect", joinPostRoom);
      socket.off("post:likes-updated", handleLikeUpdate);
      socket.off("connect_error", handleConnectError);
      socket.off("post:comment-created", handleCommentCreated);
      socket.off("post:comment-updated", handleCommentUpdated);
      socket.off("post:comment-deleted", handleCommentDeleted);
      socket.off("post:comments-updated", handleCommentsUpdated);
      // Do not disconnect the shared socket here.
    };
  }, [postId, setLikesCount, setComments, setCommentsCount]);
}
