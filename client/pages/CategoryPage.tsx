import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import OLXStyleHeader from "../components/OLXStyleHeader";
import CategoryBar from "../components/CategoryBar";
import BottomNavigation from "../components/BottomNavigation";
import StaticFooter from "../components/StaticFooter";

interface Subcategory {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description: string;
  count?: number;
}

interface CategoryPageProps {
  categoryName: string;
  categorySlug: string;
  categoryIcon?: string;
  categoryDescription?: string;
}

export default function CategoryPage({
  categoryName,
  categorySlug,
  categoryIcon,
  categoryDescription,
}: CategoryPageProps) {
  const navigate = useNavigate();
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryInfo, setCategoryInfo] = useState<any>(null);

  useEffect(() => {
    fetchCategoryAndSubcategories();
  }, [categorySlug]);

  const fetchCategoryAndSubcategories = async () => {
    try {
      setLoading(true);

      // Fetch from the categories API with subcategories
      const apiResponse = await (window as any).api(
        `/categories/${categorySlug}?withSub=true`,
      );

      console.log("📡 Category API Response:", {
        url: `/categories/${categorySlug}?withSub=true`,
        ok: apiResponse.ok,
        status: apiResponse.status,
        response: apiResponse.json,
      });

      let fetchedSubcategories: Subcategory[] = [];
      let categoryData: any = null;

      if (apiResponse.ok && apiResponse.json?.success) {
        const data = apiResponse.json.data;
        console.log("📦 Category Data:", data);

        if (Array.isArray(data)) {
          // Array response
          fetchedSubcategories = data.map((sub: any) => ({
            id: sub._id || sub.id,
            _id: sub._id,
            name: sub.name,
            slug: sub.slug,
            description: sub.description || "",
            count: sub.count || 0,
          }));
        } else if (data && typeof data === "object") {
          // Object response with category info
          categoryData = data;
          console.log("🏢 Category Info:", categoryData);
          console.log("📋 Subcategories from data:", data.subcategories);

          fetchedSubcategories = (data.subcategories || []).map((sub: any) => ({
            id: sub._id || sub.id,
            _id: sub._id,
            name: sub.name,
            slug: sub.slug,
            description: sub.description || "",
            count: sub.count || 0,
          }));
        }
      } else {
        console.warn("❌ Category API returned non-OK; using empty list", {
          ok: apiResponse.ok,
          status: apiResponse.status,
          error: apiResponse.json?.error,
        });
      }

      console.log("✅ Final subcategories:", fetchedSubcategories);
      setCategoryInfo(categoryData);
      setSubcategories(fetchedSubcategories);
    } catch (error) {
      console.error("Error fetching category:", error);
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubcategoryClick = (subcategory: Subcategory) => {
    // Navigate to category properties with both category and subcategory
    // Use the new route format for proper path routing
    navigate(`/${categorySlug}/${subcategory.slug}`, {
      state: { category: categoryName, subcategory: subcategory.name },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#C70000] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {categoryName}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OLXStyleHeader />
      <CategoryBar />

      <main className="flex-1">
        {/* Hero Section */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <span>Home</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-[#C70000] font-medium">{categoryName}</span>
            </div>

            <div className="flex items-start gap-4">
              {categoryIcon && (
                <div className="text-5xl bg-red-50 rounded-lg p-4 flex items-center justify-center w-20 h-20">
                  {categoryIcon}
                </div>
              )}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  {categoryName}
                </h1>
                <p className="text-gray-600 text-lg">
                  {categoryDescription ||
                    `Explore all ${categoryName} listings in Rohtak`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Subcategories Section */}
        <div className="container mx-auto px-4 py-12">
          {subcategories.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">
                No subcategories available
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Available Options
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id || subcategory.slug}
                    onClick={() => handleSubcategoryClick(subcategory)}
                    className="bg-white rounded-lg p-6 border border-gray-200 hover:border-[#C70000] hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-[#C70000] transition-colors">
                        {subcategory.name}
                      </h3>
                      <span className="bg-red-50 text-[#C70000] px-3 py-1 rounded-full text-sm font-semibold">
                        {subcategory.count || 0}
                      </span>
                    </div>
                    {subcategory.description && (
                      <p className="text-gray-600 text-sm mb-4">
                        {subcategory.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[#C70000] font-semibold text-sm group-hover:gap-3 transition-all">
                      View Listings
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <BottomNavigation />
      <StaticFooter />
    </div>
  );
}
