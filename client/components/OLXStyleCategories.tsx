import React, { useEffect, useState } from "react";
import {
  Car,
  Building2,
  Smartphone,
  Briefcase,
  Shirt,
  Bike,
  Tv,
  Truck,
  Sofa,
  Heart,
} from "lucide-react";
import { withApiErrorBoundary } from "./ApiErrorBoundary";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

/* ---------- Icons map (fallback to Building2) ---------- */
const categoryIcons: Record<string, any> = {
  Cars: Car,
  Properties: Building2,
  Mobiles: Smartphone,
  Jobs: Briefcase,
  Fashion: Shirt,
  Bikes: Bike,
  "Electronics & Appliances": Tv,
  "Commercial Vehicles & Spares": Truck,
  Furniture: Sofa,
  Pets: Heart,
};

/* ---------- Types ---------- */
interface Category {
  _id?: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  subcategories?: any[];
  order?: number;
  active?: boolean;
}

/* ---------- Helpers ---------- */
const norm = (v?: string) =>
  (v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

const isMatch = (cat: Category, ...candidates: string[]) => {
  const n = norm(cat.slug) || norm(cat.name);
  return candidates.map(norm).includes(n);
};

/** Special routes for specific category names/slugs */
const ROUTE_OVERRIDES: Record<string, string> = {
  "new-projects": "/new-projects",
  maps: "/maps",
  buy: "/buy",

  sell: "/post-property",
  rent: "/rent",
  lease: "/lease",
  "co-living": "/co-living",
  agricultural: "/agricultural",
  commercial: "/commercial",
  "other-services": "/other-services/other-services",
};

/** Ye 3 categories hamesha show honi chahiye */
const MUST_HAVE_CATEGORIES: { name: string; slug: string }[] = [
  { name: "Other Services", slug: "other-services" },
  { name: "Maps", slug: "maps" },
  { name: "New Projects", slug: "new-projects" },
];

/* ---------- Component ---------- */
function OLXStyleCategories() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<Category | null>(null);

  const mapFromApi = (raw: any): Category => ({
    _id: raw?._id,
    name: raw?.name ?? "",
    slug: raw?.slug ?? "",
    icon: raw?.iconUrl ?? raw?.icon ?? "",
    description: raw?.description ?? "",
    subcategories: raw?.subcategories ?? [],
    order: raw?.sortOrder ?? raw?.order ?? 999,
    active: raw?.isActive ?? raw?.active ?? true,
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get("categories?active=true&withSub=true");
      const data = res?.data;

      let list: Category[] = [];

      if (data?.success && Array.isArray(data.data)) {
        list = data.data.map(mapFromApi);
      }

      // sirf active categories
      list = list.filter((c) => c.active !== false);

      // ensure must-have categories exist
      const existingSlugs = new Set(list.map((c) => norm(c.slug)));
      const extras: Category[] = MUST_HAVE_CATEGORIES.filter(
        (m) => !existingSlugs.has(norm(m.slug)),
      ).map((m) => ({
        name: m.name,
        slug: m.slug,
        order: 999,
        active: true,
      }));

      // merge + sort by order
      const finalList = [...list, ...extras].sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999),
      );

      setCategories(finalList);
    } catch (err) {
      console.error("Error loading categories", err);
      // error pe blank hi rehne do, skeleton already dikhega
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();

    // agar kahin se window.dispatchEvent("categories:updated") fire kar rahe ho,
    // to home pe bhi auto-refresh ho jayega
    const handler = () => fetchCategories();
    window.addEventListener("categories:updated", handler);
    return () => window.removeEventListener("categories:updated", handler);
  }, []);

  /* ---------- Click handling with overrides ---------- */
  const handleCategoryClick = (category: Category) => {
    const slugKey = category.slug ? norm(category.slug) : "";
    const nameKey = norm(category.name);

    if (slugKey && ROUTE_OVERRIDES[slugKey]) {
      navigate(ROUTE_OVERRIDES[slugKey]);
      return;
    }
    if (ROUTE_OVERRIDES[nameKey]) {
      navigate(ROUTE_OVERRIDES[nameKey]);
      return;
    }

    if (isMatch(category, "buy", "sale", "rent", "lease", "pg")) {
      navigate(`/${norm(category.slug)}`);
      return;
    }

    const finalSlug = norm(category.slug) || norm(category.name) || "category";
    navigate(`/${finalSlug}`);
  };

  const handleSellClick = () => navigate("/post-property");

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="bg-white">
        <div className="px-4 pb-6 pt-6">
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gray-200 rounded-lg animate-pulse mb-2" />
                <div className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="bg-white">
      <div className="px-4 pb-4 mt-6 md:mt-8 lg:mt-10">
        <div className="grid grid-cols-5 gap-3">
          {(categories || []).map((category, index) => {
            if (!category?.name) return null;

            const IconComponent =
              categoryIcons[category.name] || Building2;
            const isActive = activeCat?.slug === category.slug;

            const isSell =
              norm(category.slug) === "sell" ||
              norm(category.name) === "sell";

            return (
              <div
                key={category._id || category.slug || index}
                onClick={() => {
                  setActiveCat(category);
                  if (isSell) {
                    handleSellClick();
                  } else {
                    handleCategoryClick(category);
                  }
                }}
                className={`flex flex-col items-center cursor-pointer active:scale-95 transition-transform ${
                  isActive ? "opacity-100" : "opacity-90"
                }`}
              >
                <div
                  className={`w-14 h-14 ${
                    isActive ? "bg-red-100" : "bg-red-50"
                  } border border-red-100 rounded-lg flex items-center justify-center mb-2 hover:bg-red-100 transition-colors`}
                >
                  <IconComponent className="h-7 w-7 text-[#C70000]" />
                </div>
                <span className="text-xs text-gray-800 text-center font-medium leading-tight">
                  {category.name.length > 12
                    ? `${category.name.substring(0, 12)}...`
                    : category.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default withApiErrorBoundary(OLXStyleCategories);
