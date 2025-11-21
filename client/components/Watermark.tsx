// components/Watermark.tsx
import React, { useEffect, useRef } from "react";
import clsx from "clsx";

type Props = {
  text?: string;
  small?: boolean;
  className?: string;
  /** "badge" for card chip, "tiled" for big image overlay.
   *  NOTE: legacy "pattern" is treated as "tiled" only (no background-repeat). */
  variant?: "badge" | "tiled" | "pattern";
  /** only for tiled; default 3; hard-cap 6 */
  count?: number;
  /** opacity 0..1 */
  opacity?: number;
  /** rotation in degrees */
  rotate?: number;
};

export default function Watermark({
  text = "ashishproperties.in",
  small = false,
  className = "",
  // ✅ default = tiled so bina kuch pass kiye 3 marks hi aayenge
  variant = "tiled",
  count = 3,
  opacity,
  rotate = -20,
}: Props) {
  // treat legacy "pattern" as "tiled"
  const mode: "badge" | "tiled" = variant === "pattern" ? "tiled" : variant;

  const rootRef = useRef<HTMLDivElement>(null);

  // 🔥 Hard kill: yahan ke scope me jitne bhi purane SVG-tile background overlays hain, remove
  useEffect(() => {
    const scope =
      (function findScope(n: HTMLElement | null): HTMLElement {
        if (!n) return document.body as HTMLElement;
        const cs = getComputedStyle(n);
        if (/(relative|absolute|fixed)/i.test(cs.position)) return n;
        return findScope(n.parentElement);
      })(rootRef.current?.parentElement || null) || document.body;

    const killers = scope.querySelectorAll<HTMLElement>(
      '[style*="data:image/svg+xml"], [style*="background-image"][style*="data:image/svg+xml"]'
    );
    killers.forEach((el) => {
      el.style.backgroundImage = "none";
      el.style.background = "transparent";
      el.style.display = "none";
    });
  }, []);

  // ---- badge (cards, single chip) ----
  if (mode === "badge" || small) {
    return (
      <div
        ref={rootRef}
        className={clsx(
          "pointer-events-none select-none absolute bottom-2 right-2 z-10",
          className
        )}
        aria-hidden
        data-wm="badge"
      >
        <span
          className={clsx(
            "inline-block rounded-md bg-black/80 text-white font-semibold shadow",
            small ? "text-[11px] px-3 py-1.5" : "text-sm px-3 py-1.5"
          )}
          style={{ opacity: opacity ?? 0.85, whiteSpace: "nowrap" }}
        >
          {text}
        </span>
      </div>
    );
  }

  // ---- tiled (exactly N marks; default 3, cap 6) ----
  const N = Math.max(1, Math.min(Number.isFinite(count) ? (count as number) : 3, 6));
  const anchors: Array<React.CSSProperties> = [
    { top: "12%", left: "8%" },    // 1
    { top: "45%", left: "35%" },   // 2 (center-ish)
    { bottom: "12%", right: "8%" },// 3
    { top: "18%", right: "12%" },  // extras if count > 3
    { bottom: "18%", left: "12%" },
    { top: "60%", right: "40%" },
  ];

  return (
    <div
      ref={rootRef}
      className={clsx("absolute inset-0 pointer-events-none select-none z-10", className)}
      aria-hidden
      data-wm={`tiled-${N}`}
    >
      {Array.from({ length: N }).map((_, i) => (
        <span
          key={i}
          className="absolute font-bold tracking-wide"
          style={{
            ...(anchors[i] || anchors[anchors.length - 1]),
            transform: `rotate(${rotate}deg)`,
            opacity: opacity ?? 0.18,
            fontSize: "clamp(12px, 2.2vw, 22px)",
            color: "#000",
            textShadow:
              "0 1px 1px rgba(255,255,255,0.35), 0 0 1px rgba(255,255,255,0.35)",
            whiteSpace: "nowrap",
            background: "transparent",
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
