import React, { useEffect, useState } from "react";

/**
 * Logo badge for the red header.
 * - Sits to the right of the hamburger (no overlap / no clipping)
 * - On small screens: only round "AP" badge
 * - On md+ screens: badge + wordmark
 * - Falls back to text if logo image missing
 */

export default function HomeTopBar() {
  const [src, setSrc] = useState<string | null>(null);
  const candidates = [
    "/brand/ashishproperties-logo.svg",
    "/brand/ashishproperties-logo.png",
    "/icons/icon-192.png", // last resort (already in public/)
  ];

  useEffect(() => {
    let i = 0;
    const img = new Image();
    const tryNext = () => {
      if (i >= candidates.length) {
        setSrc(null);
        return;
      }
      const test = candidates[i++];
      img.onload = () => setSrc(test);
      img.onerror = tryNext;
      img.src = test;
    };
    tryNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <a
        href="/"
        aria-label="Ashish Properties Home"
        // keep clear of the hamburger (≈48–56px wide)
        className="fixed top-2 left-16 md:left-20 z-[9999] inline-flex items-center gap-2 no-underline"
        style={{ pointerEvents: "auto" }}
      >
        {src ? (
          <img
            src={src}
            alt="Ashish Properties"
            className="hidden md:inline-block h-8 md:h-9 w-auto select-none drop-shadow-md"
            draggable={false}
          />
        ) : (
          <span className="hidden md:inline-flex h-8 w-8 md:h-9 md:w-9 rounded-full bg-white/90 text-red-700 font-extrabold flex items-center justify-center shadow-sm">
            AP
          </span>
        )}


        <span className="sr-only">ashishproperties.in</span>
      </a>
    </>
  );
}
