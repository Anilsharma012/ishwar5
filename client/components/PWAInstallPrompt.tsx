import React, { useEffect } from "react";

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window as any).navigator?.standalone === true);

export default function PWAInstallPrompt() {
  useEffect(() => {
    // Keep installed flag synced (agar user PWA se install kare)
    const onInstalled = () => {
      try {
        localStorage.setItem("pwa-installed", "true");
      } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // Banner UI PWAInstallButton hi handle karega
  return null;
}
