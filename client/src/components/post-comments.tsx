import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ChevronDown, Trash2, Pencil, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Comment } from "@/lib/types";

type PostCommentsProps = {
  comments: Comment[];
  commentsCount: number;
  commentText: string;
  commentLoading: boolean;
  commentSubmitting: boolean;
  currentUserId: number | null;
  deletingCommentId: number | null;
  replyingToId: number | null;
  replyText: string;
  replySubmitting: boolean;
  editingCommentId: number | null;
  editingCommentText: string;
  savingEdit: boolean;
  visibleReplies: Record<number, number>;
  setCommentText: (value: string) => void;
  setReplyingToId: (value: number | null) => void;
  setReplyText: (value: string) => void;
  setEditingCommentId: (value: number | null) => void;
  setEditingCommentText: (value: string) => void;
  setVisibleReplies: Dispatch<SetStateAction<Record<number, number>>>;
  handleAddComment: (event: FormEvent<HTMLFormElement>) => void;
  handleAddReply: (event: FormEvent<HTMLFormElement>, parentId: number) => void;
  handleEditComment: (event: FormEvent<HTMLFormElement>, commentId: number) => void;
  handleDeleteComment: (commentId: number, parentCommentId: number | null) => void;
};

export function PostComments(props: PostCommentsProps) {
  const {
    comments, commentsCount, commentText, commentLoading, commentSubmitting,
    currentUserId, deletingCommentId, replyingToId, replyText, replySubmitting,
    editingCommentId, editingCommentText, savingEdit, visibleReplies,
    setCommentText, setReplyingToId, setReplyText, setEditingCommentId,
    setEditingCommentText, setVisibleReplies, handleAddComment, handleAddReply,
    handleEditComment, handleDeleteComment,
  } = props;

  return (
    <div className="mt-10">
      <h3 className="text-lg font-semibold">
        Comments · {commentsCount}
      </h3>
      <form
        onSubmit={handleAddComment}
        className="mt-4 flex gap-3"
      >
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={commentSubmitting}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {commentSubmitting ? "Posting..." : "Post"}
        </button>
      </form>
      <div className="mt-6 space-y-5">
        {commentLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading comments...
          </p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first to comment.
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex w-full items-start justify-between gap-3">
                {/* Author information */}
                <Link
                  to="/profile/user/$id"
                  params={{ id: String(comment.author.id) }}
                  className="flex min-w-0 items-center gap-3 hover:opacity-80"
                >
                  {comment.author.avatar ? (
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border/50"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {comment.author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {comment.author.name}
                    </p>
                
                    <p className="truncate text-xs text-muted-foreground">
                      @{comment.author.handle}
                    </p>
                  </div>
                </Link> 
                {/* Author actions — aligned upper right */}
                {currentUserId === comment.author.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingCommentText(comment.content);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                      title="Edit comment"
                      aria-label="Edit comment"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id, null)}
                      disabled={deletingCommentId === comment.id}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      title="Delete comment"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 text-sm leading-6 text-foreground/90">
                {editingCommentId === comment.id ? (
                  <form
                    onSubmit={(e) => handleEditComment(e, comment.id)}
                    className="mt-3 space-y-2"
                  >
                    <textarea
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {savingEdit ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingCommentText("");
                        }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-foreground/90">
                    {comment.content}
                  </p>
                )}
              </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setReplyingToId(
                        replyingToId === comment.id ? null : comment.id
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      replyingToId === comment.id
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {replyingToId === comment.id ? "Cancel reply" : "Reply"}
                  </button>
                </div>
                {replyingToId === comment.id && (
                  <form
                    onSubmit={(e) => handleAddReply(e, comment.id)}
                    className="mt-3 flex w-full items-center gap-2 rounded-xl border border-border bg-muted/30 p-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        autoFocus
                        className="min-w-0 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={replySubmitting || !replyText.trim()}
                      className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {replySubmitting ? "Sending..." : "Send"}
                    </button>
                  </form>
                )}
              {comment.replies?.length > 0 && (
                <div className="mt-4 border-l-2 border-border pl-4">
                  {(() => {
                    const totalReplies = comment.replies.length;
                    const visibleCount = visibleReplies[comment.id] ?? 1;
                    const displayedReplies = comment.replies.slice(0, visibleCount);
                    const remainingReplies = totalReplies - visibleCount;
                    const nextBatch = Math.min(5, remainingReplies);
                    return (
                      <>
                        <div className="space-y-3">
                          {displayedReplies.map((reply) => (
                            <div
                              key={reply.id}
                              className="rounded-lg bg-secondary/40 p-3"
                            >
                                <div className="flex items-center gap-2">
                                  <Link
                                    to="/profile/user/$id"
                                    params={{ id: String(reply.author.id) }}
                                    className="flex min-w-0 items-center gap-2 hover:opacity-80"
                                  >
                                    {reply.author.avatar ? (
                                      <img
                                        src={reply.author.avatar}
                                        alt={reply.author.name}
                                        className="h-7 w-7 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                                        {reply.author.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                
                                    <div>
                                      <p className="text-xs font-medium">
                                        {reply.author.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        @{reply.author.handle}
                                      </p>
                                    </div>
                                  </Link>
                                  
                                  <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
                                    {currentUserId === reply.author.id && (
                                      <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(reply.id);
                                    setEditingCommentText(reply.content);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-primary"
                                  title="Edit reply"
                                  aria-label="Edit reply"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(reply.id, comment.id)}
                                  disabled={deletingCommentId === reply.id}
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                  title="Delete reply"
                                  aria-label="Delete reply"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              <div className="mt-2 text-sm leading-6 text-foreground/90">
                                {editingCommentId === reply.id ? (
                                  <form
                                    onSubmit={(e) => handleEditComment(e, reply.id)}
                                    className="mt-2 space-y-2"
                                  >
                                    <textarea
                                      value={editingCommentText}
                                      onChange={(e) => setEditingCommentText(e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="submit"
                                        disabled={savingEdit}
                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                                      >
                                        {savingEdit ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(null);
                                          setEditingCommentText("");
                                        }}
                                        className="rounded-lg border border-border px-3 py-1.5 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <p className="mt-2 text-sm leading-6 text-foreground/90">
                                    {reply.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {remainingReplies > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleReplies((prev) => ({
                                ...prev,
                                [comment.id]: visibleCount + 5,
                              }))
                            }
                            className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                          >
                            <ChevronDown className="h-4 w-4" />
                            Show {nextBatch} more{" "}
                            {nextBatch === 1 ? "reply" : "replies"}
                            <span className="text-muted-foreground">
                              ({remainingReplies} remaining)
                            </span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
