import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export type AdminCounts = {
  pendingCount: number;
  resubmittedCount: number;
  reportsPending: number;
  bankTransfersPending: number;
  reviewsPending: number;
  enquiriesPending: number;
};

export function useAdminCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<AdminCounts>({
    pendingCount: 0,
    resubmittedCount: 0,
    reportsPending: 0,
    bankTransfersPending: 0,
    reviewsPending: 0,
    enquiriesPending: 0,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (!user || user.userType !== "admin") return;
        const res = await api.get("/api/admin/notifications/counts");
        if (res?.success && alive) {
          const d = res.data || {};
          setCounts({
            pendingCount: d.pendingCount || 0,
            resubmittedCount: d.resubmittedCount || 0,
            reportsPending: d.reportsPending || 0,
            bankTransfersPending: d.bankTransfersPending || 0,
            reviewsPending: d.reviewsPending || 0,
            enquiriesPending: d.enquiriesPending || 0,
          });
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 30000); // refresh every 30s
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user]);

  return counts;
}
