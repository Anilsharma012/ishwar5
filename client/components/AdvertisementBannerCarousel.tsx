import React, { useState, useEffect, useMemo } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "./ui/carousel";

export interface BannerAd {
  _id?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  img?: string;
  url?: string;
  path?: string;
  filePath?: string;
  link?: string;
  sortOrder?: number;
  isActive?: boolean;
  position?: string;
}

interface AdvertisementBannerCarouselProps {
  onBannerClick?: (bannerType: string) => void;
}

const FALLBACKS = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
];

const readImgKey = (b: any): string | null =>
  b?.imageUrl ?? b?.image ?? b?.img ?? b?.path ?? b?.filePath ?? b?.url ?? null;

function forceExtimgProxy(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  let u = raw.trim();
  if (!u) return null;

  if (
    u.startsWith("/uploads/") ||
    u.startsWith("/server/uploads/") ||
    /^\.?\/?uploads\//i.test(u)
  ) {
    return u
      .replace(/^\.?\/?/i, "/")
      .replace(/^\/server\/uploads\//i, "/uploads/");
  }
  if (u.startsWith("/extimg/")) return u;

  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      const scheme = url.protocol.replace(":", "");
      const path = url.pathname.replace(/^\/+/, "");
      return `/extimg/${scheme}/${url.hostname}/${path}${url.search}`;
    } catch {
      return u;
    }
  }
  if (u.startsWith("//")) {
    try {
      const proto =
        typeof window !== "undefined" && window.location?.protocol
          ? window.location.protocol
          : "https:";
      const tmp = new URL(proto + u);
      const scheme = tmp.protocol.replace(":", "");
      const path = tmp.pathname.replace(/^\/+/, "");
      return `/extimg/${scheme}/${tmp.hostname}/${path}${tmp.search}`;
    } catch {
      return u;
    }
  }
  if (/^[a-z0-9.-]+\//i.test(u)) {
    return `/extimg/https/${u.replace(/^\/+/, "")}`;
  }
  return u.startsWith("/") ? u : `/${u}`;
}

const toImgUrl = (b: any): string =>
  forceExtimgProxy(readImgKey(b) || "") || "/placeholder.svg";

const AdvertisementBannerCarousel: React.FC<
  AdvertisementBannerCarouselProps
> = ({ onBannerClick }) => {
  const [banners, setBanners] = useState<BannerAd[]>([]);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultSlides = useMemo<BannerAd[]>(
    () =>
      FALLBACKS.map((src, i) => ({
        _id: `ad-default-${i + 1}`,
        title:
          i === 0
            ? "Advertise Your New Residential Project in Rohtak"
            : i === 1
              ? "Advertise Your New Commercial Project in Rohtak"
              : i === 2
                ? "Advertise Your Real Estate Investment Project in Rohtak"
                : "Advertise Your Industrial Property in Rohtak",
        imageUrl: src,
        link: "",
        sortOrder: i + 1,
        position: "advertisement_banners",
      })),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/banners?position=advertisement_banners&active=true&t=${Date.now()}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const incoming: any[] =
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data?.banners) && data.banners) ||
          (Array.isArray(data) && data) ||
          [];

        const cleaned = incoming
          .map((x) => ({
            ...x,
            imageUrl: toImgUrl(x),
            sortOrder: typeof x?.sortOrder === "number" ? x.sortOrder : 999,
          }))
          .filter((x) => !!x.imageUrl)
          .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

        console.info(
          "[AdvertisementBannerCarousel] loaded",
          cleaned.length,
          "banners",
        );
        setBanners(cleaned.length ? cleaned : defaultSlides);
      } catch (e: any) {
        console.warn("Advertisement banner fetch failed:", e?.message || e);
        setError("Unable to load advertisement banners");
        setBanners(defaultSlides);
      } finally {
        setLoading(false);
      }
    })();
  }, [defaultSlides]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect as any);
    };
  }, [api]);

  useEffect(() => {
    if (!api || banners.length <= 1) return;
    let paused = false;
    const root = document.querySelector(".advertisement-carousel");
    const onEnter = () => (paused = true);
    const onLeave = () => (paused = false);
    root?.addEventListener("mouseenter", onEnter);
    root?.addEventListener("mouseleave", onLeave);

    const id = setInterval(() => {
      if (!paused) {
        if (api.canScrollNext()) api.scrollNext();
        else api.scrollTo(0);
      }
    }, 6000);

    return () => {
      clearInterval(id);
      root?.removeEventListener("mouseenter", onEnter);
      root?.removeEventListener("mouseleave", onLeave);
    };
  }, [api, banners.length]);

  const handleBannerClick = (b: BannerAd) => {
    // Determine banner type from position in array or title
    const index = banners.indexOf(b);
    const types = ["residential", "commercial", "investment", "industrial"];
    const bannerType = types[index % 4] || "residential";

    if (onBannerClick) {
      onBannerClick(bannerType);
    }
  };

  const go = (i: number) => api?.scrollTo(i);

  if (loading) {
    return (
      <div className="advertisement-carousel relative w-full h-64 bg-gray-200 animate-pulse" />
    );
  }

  return (
    <div className="advertisement-carousel relative w-full h-64 sm:h-80 md:h-96 overflow-hidden bg-black">
      <Carousel
        opts={{ align: "start", loop: true }}
        setApi={setApi}
        className="w-full h-full"
      >
        <CarouselContent className="h-full -ml-0">
          {banners.map((b, i) => (
            <CarouselItem
              key={b._id || i}
              className="h-full basis-full pl-0 cursor-pointer"
              onClick={() => handleBannerClick(b)}
            >
              <div className="relative w-full h-full">
                <img
                  src={b.imageUrl!}
                  alt={b.title || `advertisement-${i + 1}`}
                  className="w-full h-full object-cover block bg-black"
                  loading={i === 0 ? "eager" : "lazy"}
                  onError={(e) => {
                    console.warn(
                      "Advertisement banner image failed:",
                      (e.currentTarget as HTMLImageElement).src,
                    );
                    (e.currentTarget as HTMLImageElement).src =
                      FALLBACKS[i % FALLBACKS.length] || "/placeholder.svg";
                  }}
                />
                {/* Overlay */}
                <div className="pointer-events-none absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
                  <div className="text-center text-white max-w-3xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 drop-shadow">
                      {b.title || "Advertise Your Project"}
                    </h2>
                    {b.description && (
                      <p className="text-sm sm:text-base text-white/90 drop-shadow">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {banners.length > 1 && (
          <>
            <CarouselPrevious className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/25 hover:bg-white/35 text-white border-none backdrop-blur z-20" />
            <CarouselNext className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/25 hover:bg-white/35 text-white border-none backdrop-blur z-20" />
          </>
        )}
      </Carousel>

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === current
                  ? "bg-white scale-110"
                  : "bg-white/60 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="absolute top-3 right-3 z-40 text-xs bg-red-600/90 text-white px-2.5 py-1.5 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default AdvertisementBannerCarousel;
