import React, { useEffect, useMemo, useState } from "react";
import { X, Download } from "lucide-react";

const APK_URL = "/api/app/download";
const STORAGE_KEY = "ap_download_popup_hidden";

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export default function AppDownloadPopup() {
  const [open, setOpen] = useState(false);

  const android = useMemo(() => isAndroid(), []);
  const hidden = useMemo(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  }, []);

  useEffect(() => {
    // Show only on Android + not hidden
    if (android && !hidden) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [android, hidden]);

  if (!open) return null;

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOpen(false);
  };

  const forceDownload = async () => {
    try {
      const res = await fetch(APK_URL);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = APK_URL.split("/").pop() || "app.apk";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.location.href = APK_URL; // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:w-[420px] mx-4 rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">Download Android App</div>
          <button onClick={close} className="p-1 rounded hover:bg-black/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 text-sm text-gray-700 space-y-3">
          <p>
            Ashish Properties Android app download karein. Chrome ka “Add to Home Screen”
            PWA prompt disable hai — ab seedha APK download hoga.
          </p>

          <div className="flex gap-2">
            <a
              href={APK_URL}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:opacity-90"
            >
              <Download size={16} />
              Download APK
            </a>

            <button
              onClick={() => { window.location.href = APK_URL; }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              title="Try alternate download"
            >
              Alternate
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Note: “Unknown Sources” enable karna pad sakta hai (Settings → Security).
          </p>
        </div>
      </div>
    </div>
  );
}
