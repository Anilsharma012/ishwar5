import React, { useState, useEffect } from "react";
import OLXStyleHeader from "../components/OLXStyleHeader";
import OLXStyleCategories from "../components/OLXStyleCategories";
import TopBanner from "../components/TopBanner";
import OLXStyleListings from "../components/OLXStyleListings";
import PackagesShowcase from "../components/PackagesShowcase";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import PWAInstallButton from "../components/PWAInstallButton";
import BottomNavigation from "../components/BottomNavigation";
import HomepageBanner from "../components/HomepageBanner";
import StaticFooter from "../components/StaticFooter";
import HeroImageSlider from "../components/HeroImageSlider";
import PropertyAdsSlider from "../components/PropertyAdsSlider";
import AdSlot from "../components/AdSlot";
import AdvertisementBannerCarousel from "../components/AdvertisementBannerCarousel";
import AdvertisementForm from "../components/AdvertisementBanners";

export default function Index() {
  const [showAdForm, setShowAdForm] = useState(false);
  const [selectedBannerType, setSelectedBannerType] = useState<
    "residential" | "commercial" | "investment" | "industrial"
  >("residential");

  // Initialize advertisement banners on mount
  useEffect(() => {
    const initializeBanners = async () => {
      try {
        const response = await fetch(
          "/api/banners?position=advertisement_banners&active=true",
        );
        const data = await response.json();

        if (!Array.isArray(data?.data) || data.data.length === 0) {
          // If no banners exist, initialize them
          await fetch("/api/admin/advertisement-banners/initialize", {
            method: "POST",
          }).catch(() => {
            // Silently fail if not admin - banners will use defaults
          });
        }
      } catch (error) {
        console.warn("Banner initialization check failed:", error);
      }
    };

    initializeBanners();
  }, []);

  const handleBannerClick = (
    bannerType: "residential" | "commercial" | "investment" | "industrial",
  ) => {
    setSelectedBannerType(bannerType);
    setShowAdForm(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <OLXStyleHeader />
      <main className="pb-16 bg-gradient-to-b from-red-50 to-white">
        {/* Big banner above hero */}
        {/* <TopBanner /> */}

        {/* Hero Image Slider */}
        {/*<HeroImageSlider /> */}

        {/* Advertisement Banner Carousel */}
        <AdvertisementBannerCarousel onBannerClick={handleBannerClick} />

        {/* Dynamic Categories (moved up as requested) */}
        <OLXStyleCategories />

        {/* Ad Slot: Below categories (CLS-safe) */}
        <div className="px-4 mt-4">
          <AdSlot format="horizontal" slotKey="below_categories" />
        </div>

        {/* Featured Property Ads Slider (moved below categories) */}
        <PropertyAdsSlider />

        {/* Mid-size banner below categories */}
        <div className="px-4 mb-6 bg-white py-6">
          <HomepageBanner position="homepage_middle" />
        </div>

        <div className="bg-white">
          <OLXStyleListings />
        </div>

        <div className="bg-red-50 py-8">
          <PackagesShowcase />
        </div>
      </main>
      <BottomNavigation />
      <PWAInstallPrompt />
      <PWAInstallButton />
      <StaticFooter />

      {/* Advertisement Form Modal */}
      <AdvertisementForm
        isOpen={showAdForm}
        onClose={() => setShowAdForm(false)}
        bannerType={selectedBannerType}
      />
    </div>
  );
}
