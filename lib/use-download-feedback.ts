"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useDownloadFeedback(duration = 1800) {
  const [downloadedKey, setDownloadedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDownloaded = useCallback(
    (key: string) => {
      if (timer.current) clearTimeout(timer.current);
      setDownloadedKey(key);
      timer.current = setTimeout(() => setDownloadedKey(null), duration);
    },
    [duration],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    downloadedKey,
    markDownloaded,
    labelFor: (key: string, label: string) =>
      downloadedKey === key ? "Downloaded ✓" : label,
  };
}
