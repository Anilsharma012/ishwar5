import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Lock, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface FreeAdLimitData {
  canPostFree: boolean;
  remaining: number;
  limit: number;
  used: number;
  periodDays: number;
  nextResetDate?: Date;
  systemActive: boolean;
}

export default function FreeAdLimitStatus() {
  const navigate = useNavigate();
  const [limitData, setLimitData] = useState<FreeAdLimitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFreeAdLimit();
  }, []);

  const fetchFreeAdLimit = async () => {
    try {
      const response = await api("/user/free-ad-limit", { method: "GET" });
      if (response.ok && response.data?.success) {
        setLimitData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching free ad limit:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !limitData || !limitData.systemActive) {
    return null;
  }

  if (limitData.canPostFree) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">Free Ads Available</h3>
            <p className="text-sm text-green-800 mt-1">
              You have <strong>{limitData.remaining}</strong> free ad
              {limitData.remaining !== 1 ? "s" : ""} remaining out of{" "}
              <strong>{limitData.limit}</strong> per {limitData.periodDays}{" "}
              days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">Free Ad Limit Reached</h3>
          <p className="text-sm text-red-800 mt-1">
            You have used all <strong>{limitData.limit}</strong> free ads for
            this {limitData.periodDays}-day period. To post more properties,
            please upgrade to a paid package.
          </p>
          {limitData.nextResetDate && (
            <p className="text-xs text-red-700 mt-2">
              Your limit will reset on{" "}
              <strong>
                {new Date(limitData.nextResetDate).toLocaleDateString()}
              </strong>
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              onClick={() => navigate("/packages")}
              className="gap-2"
              size="sm"
            >
              <Zap className="h-4 w-4" />
              View Paid Packages
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Refresh Status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
