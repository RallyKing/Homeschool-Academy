"use client";

import { useState } from "react";
import { hardRefreshFromWindow } from "@/lib/hardRefresh";

export function HardRefreshButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      title="Load the latest app"
      aria-label="Hard refresh"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void hardRefreshFromWindow().finally(() => setBusy(false));
      }}
      className="hover-fade inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-45"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
        aria-hidden
        className={busy ? "animate-spin" : undefined}
      >
        <path
          fill="currentColor"
          d="M8 2a6 6 0 0 1 5.3 3.2l.7-1.7a.5.5 0 0 1 .95.38l-1.2 3a.5.5 0 0 1-.66.28l-3-1.2a.5.5 0 1 1 .38-.95l1.4.56A5 5 0 1 0 13 8a.5.5 0 0 1 1 0A6 6 0 1 1 8 2Z"
        />
      </svg>
    </button>
  );
}
