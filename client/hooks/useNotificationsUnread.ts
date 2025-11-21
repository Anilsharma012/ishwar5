import { useEffect, useState } from "react";

export const useNotificationsUnread = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    // Check if user has a token before attempting to fetch
    const hasToken = () => {
      try {
        return !!(
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          localStorage.getItem("accessToken") ||
          localStorage.getItem("userToken") ||
          localStorage.getItem("adminToken")
        );
      } catch {
        return false;
      }
    };

    const fetchCount = async () => {
      // Don't fetch if user is not authenticated
      if (!hasToken()) return;

      try {
        const { api } = await import("@/lib/api");
        const res = await api.get("notifications/unread-count");
        if (!res || !res.data || !res.data.data) return;
        if (active) setCount(Number(res.data.data.unread || 0));
      } catch (e) {
        // Swallow errors to avoid UI noise
        console.warn("notifications unread fetch failed:", e?.message || e);
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return count;
};
