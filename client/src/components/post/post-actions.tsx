
import {
  Bookmark,
  Heart,
  Eye,
  MessageCircle,
  Link2,
  X,
} from "lucide-react";

interface PostActionsProps {
  liked: boolean;
  likesCount: number;
  viewCount: number;
  commentsCount: number;
  saved: boolean;
  handleLike: () => void;
  handleBookmark: () => void;
  shareOnX: () => void;
  shareOnFacebook: () => void;
  copyPostLink: () => void;
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {icon}
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}

function ShareBtn({
  icon,
  onClick,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      {icon}
    </button>
  );
}

export default function PostActions({
  liked,
  likesCount,
  viewCount,
  commentsCount,
  saved,
  handleLike,
  handleBookmark,
  shareOnX,
  shareOnFacebook,
  copyPostLink,
}: PostActionsProps) {
  return (
    <div className="mt-10 flex items-center justify-between border-y border-border py-4">
      <div className="flex items-center gap-1">
        <ActionButton
          active={liked}
          onClick={handleLike}
          icon={
            <Heart
              className={`h-4 w-4 ${
                liked ? "fill-current text-destructive" : ""
              }`}
            />
          }
          label={String(likesCount)}
        />

        <ActionButton
          icon={<Eye className="h-4 w-4" />}
          label={String(viewCount)}
        />

        <ActionButton
          icon={<MessageCircle className="h-4 w-4" />}
          label={String(commentsCount)}
        />

        <ActionButton
          active={saved}
          onClick={handleBookmark}
          icon={
            <Bookmark
              className={`h-4 w-4 ${saved ? "fill-current" : ""}`}
            />
          }
        />
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">
          Share
        </span>
        <ShareBtn icon={<X className="h-4 w-4" />} onClick={shareOnX} />
        <ShareBtn
          icon={<FacebookIcon />}
          onClick={shareOnFacebook}
        />
        <ShareBtn
          icon={<Link2 className="h-4 w-4" />}
          onClick={copyPostLink}
        />
      </div>
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
