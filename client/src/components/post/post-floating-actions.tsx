
import { Bookmark, Heart, Share2 } from "lucide-react";

interface PostFloatingActionsProps {
  liked: boolean;
  saved: boolean;
  handleLike: () => void;
  handleBookmark: () => void;
  handleShare: () => void;
}

export default function PostFloatingActions({
  liked,
  saved,
  handleLike,
  handleBookmark,
  handleShare,
}: PostFloatingActionsProps) {
  return (
    <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
      <div className="flex flex-col items-center gap-2 rounded-full border border-border bg-card p-2 shadow-soft">
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

        <ActionButton
          icon={<Share2 className="h-4 w-4" />}
          onClick={handleShare}
        />
      </div>
    </aside>
  );
}

function ActionButton({
  icon,
  onClick,
  active,
}: {
  icon: React.ReactNode;
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
    </button>
  );
}
