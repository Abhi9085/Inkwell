
import { toast } from "sonner";

interface UsePostShareProps {
  title: string;
  excerpt?: string | null;
}

export function usePostShare({ title, excerpt }: UsePostShareProps) {
  const getShareUrl = () => window.location.href;

  const shareOnX = () => {
    const url = new URL("https://twitter.com/intent/tweet");
    url.searchParams.set("url", getShareUrl());
    url.searchParams.set("text", title);

    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const shareOnFacebook = () => {
    const url = new URL("https://www.facebook.com/sharer/sharer.php");
    url.searchParams.set("u", getShareUrl());

    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const copyPostLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      toast.success("Article link copied to clipboard");
    } catch (error) {
      console.error("Failed to copy article link:", error);
      toast.error("Couldn't copy the link. Please copy the URL from your browser.");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title,
      text: excerpt || `Read "${title}" on Inkwell`,
      url: getShareUrl(),
    };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          await copyPostLink();
        }
      }
    } else {
      await copyPostLink();
    }
  };

  return {
    shareOnX,
    shareOnFacebook,
    copyPostLink,
    handleShare,
  };
}
