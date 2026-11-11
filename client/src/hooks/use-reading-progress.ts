
import { useEffect, useState } from "react";

export function useReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const element = document.documentElement;
      const scrollableHeight =
        element.scrollHeight - element.clientHeight;

      if (scrollableHeight <= 0) {
        setProgress(0);
        return;
      }

      const percentage =
        (element.scrollTop / scrollableHeight) * 100;

      setProgress(Math.min(100, Math.max(0, percentage)));
    };

    handler();

    window.addEventListener("scroll", handler, { passive: true });

    return () => {
      window.removeEventListener("scroll", handler);
    };
  }, []);

  return progress;
}
