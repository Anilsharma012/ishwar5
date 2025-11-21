import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { api } from "../../lib/api";
import { Loader2, Save } from "lucide-react";

interface FreeAdSettings {
  maxFreeAdsPerMonth: number;
  numberOfDays: number;
  isActive: boolean;
}

export default function FreeAdLimitSettings() {
  const [settings, setSettings] = useState<FreeAdSettings>({
    maxFreeAdsPerMonth: 2,
    numberOfDays: 30,
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/settings/free-ad-limit");

      if (response.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await api.put("/admin/settings/free-ad-limit", settings);

      if (response.success) {
        setMessage("Settings saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save settings");
      }
    } catch (error) {
      setMessage("Error saving settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h1 className="text-3xl font-bold mb-6">
          Free Ad Post Limiter Settings
        </h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.includes("success")
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Maximum Free Ads Per User
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.maxFreeAdsPerMonth}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxFreeAdsPerMonth: parseInt(e.target.value) || 1,
                })
              }
              className="w-full border rounded-lg px-4 py-2"
            />
            <p className="text-sm text-gray-600 mt-2">
              Number of free ads each user can post (default: 2)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Time Period (Days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.numberOfDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  numberOfDays: parseInt(e.target.value) || 30,
                })
              }
              className="w-full border rounded-lg px-4 py-2"
            />
            <p className="text-sm text-gray-600 mt-2">
              Limit is reset every X days (default: 30 days)
            </p>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.isActive}
                onChange={(e) =>
                  setSettings({ ...settings, isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-semibold">Enable Free Ad Limit System</span>
            </label>
            <p className="text-sm text-gray-600 mt-2">
              Turn on/off the free ad posting limit for all users
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              Current Configuration
            </h3>
            <p className="text-sm text-blue-800">
              Users can post <strong>{settings.maxFreeAdsPerMonth}</strong> free
              ads every <strong>{settings.numberOfDays}</strong> days
              {settings.isActive
                ? " (System is ACTIVE)"
                : " (System is INACTIVE)"}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
            <Button variant="outline" onClick={fetchSettings} type="button">
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
