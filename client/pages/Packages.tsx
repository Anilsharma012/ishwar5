import React, { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Check,
  Crown,
  Star,
  Eye,
  Clock,
  ArrowRight,
  Package as PackageIcon,
} from "lucide-react";
import type { AdPackage } from "@shared/types";
import { useNavigate } from "react-router-dom";

export default function PackagesPage() {
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPackages = async () => {
    if (fetchingRef.current) return;
    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      let data: any;
      try {
        if (typeof (window as any).api === "function") {
          const resp = await (window as any).api("/plans?isActive=true");
          data = resp?.ok ? resp.json : resp?.data;
        }
      } catch (e) {
        // fallback
      }

      if (!data) {
        const res = await fetch("/api/plans?isActive=true", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }

      if (data && data.success && Array.isArray(data.data)) {
        const fetched = data.data as AdPackage[];
        const personalConsultation: AdPackage = {
          _id: "personal-consultation",
          name: "Personal Consultation",
          description:
            "One-on-one personal consultation for listing strategy, pricing and visibility. Contact 9896095599 (10:00 AM - 6:00 PM).",
          price: 0,
          duration: 1,
          features: [
            "Direct phone consultation",
            "Listing review and optimization",
            "Pricing strategy",
            "Priority support (10:00 AM - 6:00 PM)",
          ],
          featuresHtml: [],
          premium: false,
          type: "custom",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // price 0 indicates free selection - user will be advised to call
        } as any;
        setPackages([...fetched, personalConsultation]);
      } else {
        setError("Invalid data format received");
        setPackages([]);
      }
    } catch (e) {
      setError("Failed to load packages");
      setPackages([]);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  const goCheckout = (id?: string) => {
    if (!id) return;
    navigate(`/checkout/${id}`);
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-96"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-4 mb-4">
            <PackageIcon className="h-10 w-10 text-[#C70000]" />
            <h1 className="text-4xl font-bold text-gray-900">
              Advertisement Packages
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Choose the right package to boost your property visibility and get
            more inquiries
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {packages.map((pkg, idx) => (
            <div
              key={pkg._id}
              className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 ${
                pkg.type === "premium"
                  ? "ring-2 ring-yellow-400 border-0 relative"
                  : "border border-gray-200"
              } ${idx === 1 ? "lg:scale-105" : ""}`}
            >
              {/* Premium Badge */}
              {pkg.premium && (
                <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                  <Crown className="h-4 w-4" />
                  Premium
                </div>
              )}

              {/* Card Content */}
              <div
                className={`p-6 ${pkg.type === "premium" ? "bg-gradient-to-br from-yellow-50 to-white" : "bg-white"}`}
              >
                {/* Package Name and Price */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {pkg.name}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[#C70000]">
                      {pkg.price === 0 ? "Free" : `₹${pkg.price}`}
                    </span>
                    <span className="text-gray-600">{pkg.duration} days</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-700 text-sm mb-6 leading-relaxed">
                  {pkg.description}
                </p>

                {/* Features Count Badge */}
                <div className="mb-6 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  <Star className="inline h-4 w-4 mr-1" />
                  {pkg.features.length} Features
                </div>

                {/* Features List */}
                <div className="mb-6 space-y-3">
                  {pkg.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => goCheckout(pkg._id)}
                  className={`w-full font-semibold py-3 transition-all ${
                    pkg.premium
                      ? "bg-gradient-to-r from-[#C70000] to-red-700 hover:shadow-lg text-white"
                      : "bg-[#C70000] hover:bg-red-700 text-white"
                  }`}
                >
                  {pkg.price === 0
                    ? "Choose (Free)"
                    : `Choose for ₹${pkg.price}`}{" "}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Features Comparison Section */}
        {packages.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Feature Comparison
            </h2>

            {/* Mobile: Feature List */}
            <div className="md:hidden space-y-8">
              {packages.map((pkg) => (
                <div key={pkg._id} className="border-t pt-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-4">
                    {pkg.name}
                  </h3>
                  <ul className="space-y-2">
                    {pkg.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Desktop: Comparison Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-4 px-4 font-bold text-gray-900 w-1/3">
                      Features
                    </th>
                    {packages.map((pkg) => (
                      <th
                        key={pkg._id}
                        className="text-center py-4 px-4 font-bold text-gray-900"
                      >
                        <div className="text-sm">{pkg.name}</div>
                        <div className="text-xs text-gray-600 font-normal">
                          ₹{pkg.price === 0 ? "Free" : pkg.price}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Collect all unique features */}
                  {Array.from(new Set(packages.flatMap((p) => p.features))).map(
                    (feature) => (
                      <tr
                        key={feature}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4 text-sm text-gray-700 font-medium">
                          {feature}
                        </td>
                        {packages.map((pkg) => (
                          <td key={pkg._id} className="text-center py-4 px-4">
                            {pkg.features.includes(feature) ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-gray-300 rounded mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
            <Clock className="h-6 w-6" />
            How It Works
          </h3>
          <ul className="space-y-3 text-blue-900">
            <li className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                1
              </div>
              <span>Choose the package that best fits your needs</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                2
              </div>
              <span>Complete the payment securely</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                3
              </div>
              <span>Your property gets featured with enhanced visibility</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                4
              </div>
              <span>Start receiving more inquiries and views instantly</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
