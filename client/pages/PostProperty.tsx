import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import BottomNavigation from "../components/BottomNavigation";
import PackageSelection from "../components/PackageSelection";
import PaymentForm from "../components/PaymentForm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Camera,
  X,
  Home,
  Package as PackageIcon,
  CheckCircle,
} from "lucide-react";
import { ROHTAK_AREAS } from "@shared/types";
import { getRohtakLandmarks } from "../data/rohtakLocations";
import { api } from "../lib/api";
import FreeAdLimitStatus from "../components/FreeAdLimitStatus";

/* ------------------------------
   Config
------------------------------ */
const FREE_LISTING_ENABLED = true;

// Slugs/names that must never appear in Post Property categories
const EXCLUDE_SLUGS = new Set([
  "new-projects",
  "newprojects",
  "projects",
  "maps",
  "map",
  "other-services",
  "otherservices",
  "services",
  "service",
  "tools",
  "news",
  "blog",
]);

const looksExcluded = (name?: string, slug?: string) => {
  const n = String(name || "").toLowerCase();
  const s = String(slug || "").toLowerCase();
  if (EXCLUDE_SLUGS.has(s)) return true;
  if (
    n.includes("new project") ||
    n.includes("projects") ||
    n.includes("map") ||
    n.includes("service")
  )
    return true;
  return false;
};

/* ------------------------------
   Types
------------------------------ */
interface PropertyFormData {
  title: string;
  description: string;
  price: string;
  priceType: "sale" | "rent";
  propertyType: string; // slug
  subCategory: string; // slug
  location: {
    area: string;
    address: string;
    landmark: string;
  };
  specifications: {
    bedrooms: string;
    bathrooms: string;
    area: string;
    facing: string;
    floor: string;
    totalFloors: string;
    parking: string;
    furnished: string;
  };
  amenities: string[];
  images: File[];
  contactInfo: {
    name: string;
    phone: string;
    alternativePhone?: string;
    whatsappNumber?: string;
    email: string;
  };
}

type NormalizedSubcat = { name: string; slug: string; isActive?: boolean };
type NormalizedCategory = {
  _id?: string;
  name: string;
  slug: string;
  isActive?: boolean;
  // optional meta if backend provides
  priceTypes?: ("sale" | "rent")[];
  propertyTypes?: string[];
  section?: string;
  subcategories: NormalizedSubcat[];
};

/* ------------------------------
   Helpers
------------------------------ */
const s = (v: any) => (typeof v === "string" ? v.trim() : "");
const has = (v: any) => s(v).length > 0;

// Prefer endpoints that return subcategories; normalize + filter
async function fetchDynamicCategories(): Promise<NormalizedCategory[]> {
  const tryEndpoints = [
    "/api/categories?withSub=true&type=property",
    "/api/categories?withSub=true&scope=property",
    "/api/property-types?withSub=true",
    "/api/categories?withSub=true",
    "/api/categories",
  ];

  for (const url of tryEndpoints) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) continue;
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json?.data;
      if (!Array.isArray(arr)) continue;

      const normalized: NormalizedCategory[] = arr
        .map((item: any): NormalizedCategory | null => {
          const name = item?.name ?? item?.label ?? "";
          const slug = item?.slug ?? item?.value ?? "";
          if (!name || !slug) return null;

          // meta
          const priceTypes = Array.isArray(item?.priceTypes)
            ? item.priceTypes
            : undefined;
          const propertyTypes = Array.isArray(item?.propertyTypes)
            ? item.propertyTypes
            : undefined;
          const section =
            item?.section || item?.module || item?.type || item?.scope || "";

          // subcategories from various shapes
          let subs: NormalizedSubcat[] = [];
          if (Array.isArray(item?.subcategories)) {
            subs = item.subcategories
              .map((sc: any) => {
                if (typeof sc === "string") return { name: sc, slug: sc };
                return {
                  name: sc?.name ?? sc?.label ?? "",
                  slug: sc?.slug ?? sc?.value ?? "",
                  isActive: sc?.isActive,
                };
              })
              .filter((x: any) => x?.name && x?.slug);
          } else if (Array.isArray(item?.children)) {
            subs = item.children
              .map((sc: any) => ({
                name: sc?.name ?? sc?.label ?? "",
                slug: sc?.slug ?? sc?.value ?? "",
                isActive: sc?.isActive,
              }))
              .filter((x: any) => x?.name && x?.slug);
          }

          return {
            _id: item?._id,
            name,
            slug,
            isActive: item?.isActive !== false,
            priceTypes,
            propertyTypes,
            section,
            subcategories: subs,
          };
        })
        .filter(Boolean) as NormalizedCategory[];

      if (!normalized.length) continue;

      // 1) drop inactive
      let filtered = normalized.filter((c) => c.isActive !== false);

      // 2) drop modules that must not appear in Post Property
      filtered = filtered.filter((c) => !looksExcluded(c.name, c.slug));

      // 3) Prefer property/listing sections if server tags them
      const hasSectionProperty = filtered.some((c) => {
        const sec = String(c.section || "").toLowerCase();
        return ["property", "properties", "listing", "listings"].includes(sec);
      });
      if (hasSectionProperty) {
        filtered = filtered.filter((c) => {
          const sec = String(c.section || "").toLowerCase();
          return ["property", "properties", "listing", "listings"].includes(
            sec,
          );
        });
      }

      // If still something left, return
      if (filtered.length) return filtered;
    } catch {
      // try next endpoint
    }
  }

  return [];
}

// Robust auth
async function getAuthToken(): Promise<string | null> {
  let token: string | null =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("userToken") ||
    localStorage.getItem("adminToken") ||
    null;

  if (!token) {
    try {
      const u =
        JSON.parse(localStorage.getItem("user") || "null") ||
        JSON.parse(localStorage.getItem("adminUser") || "null") ||
        null;
      token = u?.token || null;
    } catch {}
  }

  try {
    // @ts-ignore
    const fbAuth = (window as any)?.firebaseAuth || undefined;
    if (fbAuth?.currentUser?.getIdToken) {
      token = await fbAuth.currentUser.getIdToken(true);
    }
  } catch {}

  return token;
}

/* =====================================================
   Component
===================================================== */
export default function PostProperty() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [showPackageSelection, setShowPackageSelection] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedPackagePrice, setSelectedPackagePrice] = useState(0);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);

  // Dynamic categories/subcategories
  const [categories, setCategories] = useState<NormalizedCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PropertyFormData>({
    title: "",
    description: "",
    price: "",
    priceType: "sale",
    propertyType: "",
    subCategory: "",
    location: {
      area: "",
      address: "",
      landmark: "",
    },
    specifications: {
      bedrooms: "",
      bathrooms: "",
      area: "",
      facing: "",
      floor: "",
      totalFloors: "",
      parking: "",
      furnished: "",
    },
    amenities: [],
    images: [],
    contactInfo: {
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
    },
  });

  /* ===== Fetch categories on mount ===== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setCatLoading(true);
        setCatError(null);
        const cats = await fetchDynamicCategories();
        if (!alive) return;

        // Extra safety: if backend sent priceTypes meta, keep only ones compatible with selected priceType
        // (We don't hide categories at first render; we filter subs later. Keeping it simple.)
        setCategories(cats);
      } catch (e) {
        if (alive) setCatError("Failed to load categories");
        console.error(e);
      } finally {
        alive && setCatLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Derivations
  const selectedCategory = categories.find(
    (c) => c.slug === formData.propertyType,
  );

  // Only show active subs of the selected category
  const availableSubcats =
    (selectedCategory?.subcategories || []).filter(
      (sc) => sc.isActive !== false,
    ) ?? [];

  const categoryLabel =
    selectedCategory?.name ||
    (formData.propertyType ? formData.propertyType : "");
  const subCategoryLabel =
    availableSubcats.find((s) => s.slug === formData.subCategory)?.name ||
    (formData.subCategory ? formData.subCategory : "");

  /* ===== Dynamic viewport vars ===== */
  useEffect(() => {
    const setVhVars = () => {
      const dvh = Math.max(
        window.innerHeight,
        document.documentElement.clientHeight,
      );
      document.documentElement.style.setProperty("--app-dvh", dvh + "px");
    };
    setVhVars();
    window.addEventListener("resize", setVhVars);
    window.addEventListener("orientationchange", setVhVars);
    return () => {
      window.removeEventListener("resize", setVhVars);
      window.removeEventListener("orientationchange", setVhVars);
    };
  }, []);

  /* ===== BACK CONFIRM while on Package/Payment screens ===== */
  useEffect(() => {
    const guardActive = showPackageSelection || showPaymentForm;
    if (!guardActive) return;

    const message =
      "Going back will delete the property details you have filled. Are you sure you want to go back?\n\nClick OK to delete and go back, or Cancel to stay on this page.";

    try {
      window.history.pushState(null, "", window.location.href);
    } catch {}

    const onPopState = () => {
      const ok = window.confirm(message);
      if (ok) {
        try {
          localStorage.removeItem("post_property_draft");
        } catch {}
      } else {
        try {
          window.history.pushState(null, "", window.location.href);
        } catch {}
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [showPackageSelection, showPaymentForm]);

  /* ===== Auth + prefill ===== */
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      const returnTo = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.href = `/auth?returnTo=${returnTo}`;
      return;
    }

    if (user) {
      setFormData((prev) => ({
        ...prev,
        contactInfo: {
          name: user.name || "",
          phone: user.phone || "",
          email: user.email || "",
          alternativePhone: s(prev.contactInfo.alternativePhone),
          whatsappNumber: s(prev.contactInfo.whatsappNumber),
        },
      }));
    }
  }, [authLoading, isAuthenticated, user]);

  /* ===== Load property data for editing ===== */
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const editId = searchParams.get("edit");

    if (editId && isAuthenticated) {
      setIsEditMode(true);
      setEditPropertyId(editId);

      const fetchPropertyData = async () => {
        try {
          const token = await getAuthToken();
          if (!token) return;

          const response = await api.get(`/properties/${editId}`, token);
          if (response.data.success && response.data.data) {
            const property = response.data.data;

            setFormData({
              title: property.title || "",
              description: property.description || "",
              price: String(property.price || ""),
              priceType: property.priceType || "sale",
              propertyType: property.propertyType || "",
              subCategory: property.subCategory || "",
              location: {
                area: property.location?.area || "",
                address: property.location?.address || "",
                landmark: property.location?.landmark || "",
              },
              specifications: {
                bedrooms: String(property.specifications?.bedrooms || ""),
                bathrooms: String(property.specifications?.bathrooms || ""),
                area: String(property.specifications?.area || ""),
                facing: property.specifications?.facing || "",
                floor: String(property.specifications?.floor || ""),
                totalFloors: String(property.specifications?.totalFloors || ""),
                parking: property.specifications?.parking || "",
                furnished: property.specifications?.furnished || "",
              },
              amenities: property.amenities || [],
              images: [],
              contactInfo: {
                name: property.contactInfo?.name || user?.name || "",
                phone: property.contactInfo?.phone || user?.phone || "",
                email: property.contactInfo?.email || user?.email || "",
                alternativePhone: property.contactInfo?.alternativePhone || "",
                whatsappNumber: property.contactInfo?.whatsappNumber || "",
              },
            });
          }
        } catch (error) {
          console.error("Error fetching property for edit:", error);
        }
      };

      fetchPropertyData();
    }
  }, [location.search, isAuthenticated, user]);

  /* ------------------------------
     Handlers
  ------------------------------ */
  const handleInputChange = (field: string, value: string) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData(
        (prev) =>
          ({
            ...prev,
            [parent]: {
              ...(prev as any)[parent],
              [child]: value,
            },
          }) as any,
      );
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleAmenityToggle = (amenity: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (formData.images.length + files.length <= 10) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...files],
      }));
    } else {
      alert("Maximum 10 images allowed");
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // ---- Validation (subcategory required only if available) ----
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: {
        const hasBasic =
          has(formData.title) &&
          has(formData.description) &&
          has(formData.propertyType);

        if (!hasBasic) return false;

        const needSub = availableSubcats.length > 0;
        if (needSub) return has(formData.subCategory);

        return true;
      }
      case 2:
        return has(formData.price) && has(formData.location?.area);
      case 3:
        return has(formData.specifications?.area);
      case 4:
        return formData.images.length > 0;
      case 5:
        return (
          has(formData.contactInfo?.name) &&
          has(formData.contactInfo?.phone) &&
          has(formData.contactInfo?.email)
        );
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (currentStep >= stepTitles.length) return;
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, stepTitles.length));
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {}
    } else {
      let missing: string[] = [];
      if (currentStep === 1) {
        if (!has(formData.title)) missing.push("Property Title");
        if (!has(formData.description)) missing.push("Description");
        if (!has(formData.propertyType)) missing.push("Property Type");
        if (availableSubcats.length > 0 && !has(formData.subCategory))
          missing.push("Sub Category");
      }
      alert(
        missing.length
          ? `Please fill the following required fields: ${missing.join(", ")}`
          : "Please fill all required fields",
      );
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  /* ------------------------------
     Draft save/load
  ------------------------------ */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("post_property_draft");
      if (raw) {
        const draft = JSON.parse(raw) || {};
        setFormData((prev) => ({
          ...prev,
          ...draft,
          title: s(draft.title),
          description: s(draft.description),
          price: s(draft.price),
          priceType: (draft.priceType as "sale" | "rent") ?? prev.priceType,
          propertyType: draft.propertyType ?? "",
          subCategory: draft.subCategory ?? "",
          location: {
            area: s(draft.location?.area),
            address: s(draft.location?.address),
            landmark: s(draft.location?.landmark),
          },
          specifications: {
            ...prev.specifications,
            ...draft.specifications,
            area: s(draft.specifications?.area),
            bedrooms: s(draft.specifications?.bedrooms),
            bathrooms: s(draft.specifications?.bathrooms),
            facing: s(draft.specifications?.facing),
            floor: s(draft.specifications?.floor),
            totalFloors: s(draft.specifications?.totalFloors),
            parking: s(draft.specifications?.parking),
            furnished: s(draft.specifications?.furnished),
          },
          images: [],
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const { images, ...rest } = formData as any;
        localStorage.setItem("post_property_draft", JSON.stringify(rest));
      } catch {}
    }, 5000);
    return () => clearTimeout(id);
  }, [formData]);

  /* ------------------------------
     Submit
  ------------------------------ */
  const handleSubmit = async (withPackage = false) => {
    try {
      setLoading(true);

      const token = await getAuthToken();

      const submitData = new FormData();
      submitData.append("title", formData.title);
      submitData.append("description", formData.description);
      submitData.append("price", formData.price);
      submitData.append("priceType", formData.priceType);
      submitData.append("propertyType", formData.propertyType); // slug
      submitData.append("subCategory", formData.subCategory); // slug
      submitData.append("location", JSON.stringify(formData.location));
      submitData.append(
        "specifications",
        JSON.stringify(formData.specifications),
      );
      submitData.append("amenities", JSON.stringify(formData.amenities));
      submitData.append("contactInfo", JSON.stringify(formData.contactInfo));
      submitData.append("premium", withPackage.toString());
      submitData.append("contactVisible", (!withPackage).toString());

      formData.images.forEach((image) => submitData.append("images", image));

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let response;
      if (isEditMode && editPropertyId) {
        response = await fetch(`/api/properties/${editPropertyId}`, {
          method: "PUT",
          headers,
          body: submitData,
          credentials: "include",
        });
      } else {
        response = await fetch("/api/properties", {
          method: "POST",
          headers,
          body: submitData,
          credentials: "include",
        });
      }

      if (!response.ok) {
        try {
          const txt = await response.clone().text();
          console.log("POST /api/property failed:", response.status, txt);
        } catch {}
        if (response.status === 401 || response.status === 403) {
          alert("Your session has expired. Please login again.");
          [
            "token",
            "authToken",
            "accessToken",
            "userToken",
            "adminToken",
            "user",
            "adminUser",
          ].forEach((k) => localStorage.removeItem(k));
          window.location.href = "/user-login";
          return;
        }
        throw new Error(`HTTP ${response.status}: Failed to create property`);
      }

      const data = await response.json();

      if (data.success) {
        setPropertyId(data.data._id || editPropertyId);

        if (isEditMode && editPropertyId) {
          try {
            const resubmitResponse = await api.post(
              `/seller/properties/${editPropertyId}/resubmit`,
              {},
              (await getAuthToken())!,
            );

            if (resubmitResponse.data.success) {
              try {
                localStorage.removeItem("post_property_draft");
              } catch {}
              try {
                window.dispatchEvent(new Event("properties:updated"));
              } catch {}
              alert(
                "✅ Property updated and resubmitted successfully!\n\n⏳ Status: Pending Admin Review",
              );
              navigate("/my-properties");
            } else {
              alert(
                resubmitResponse.data.error || "Failed to resubmit property",
              );
            }
          } catch (error) {
            console.error("Error resubmitting property:", error);
            alert(
              "Property updated but failed to resubmit. Please try resubmitting from My Properties page.",
            );
            navigate("/my-properties");
          }
          return;
        }

        if (withPackage) {
          setShowPackageSelection(true);
        } else {
          try {
            localStorage.removeItem("post_property_draft");
          } catch {}
          try {
            window.dispatchEvent(new Event("properties:updated"));
          } catch {}
          alert(
            "✅ Property submitted!\n\n⏳ Status: Pending Admin Approval.\n\nAapki listing admin verify hone ke baad hi live hogi.",
          );
          window.location.href = "/seller-dashboard";
        }
      } else {
        alert(data.error || "Failed to post property");
      }
    } catch (error) {
      console.error("Error posting property:", error);
      alert("Failed to post property");
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = async (packageId: string) => {
    try {
      const token = await getAuthToken();

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`/api/packages/${packageId}`, {
        method: "GET",
        headers,
        credentials: "include", // important if backend also checks session cookie
      });

      if (response.status === 401 || response.status === 403) {
        alert("Session expired. Please login again.");
        return (window.location.href = "/user-login");
      }

      if (!response.ok) {
        const t = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${t}`);
      }

      const data = await response.json();
      if (data?.success && data?.data) {
        setSelectedPackage(packageId);
        setSelectedPackagePrice(Number(data.data.price || 0));
        setShowPackageSelection(false);
        setShowPaymentForm(true);
      } else {
        alert(data?.error || "Failed to load package details.");
      }
    } catch (error) {
      console.error("Error fetching package details:", error);
      alert("Failed to load package details.");
    }
  };

  const handlePaymentComplete = (_transactionId: string) => {
    try {
      localStorage.removeItem("post_property_draft");
    } catch {}
    alert(
      "✅ Payment Successful!\n\n⏳ Status: Waiting for Admin Approval\n\nYour property will be live once approved by admin.",
    );
    window.location.href = "/seller-dashboard";
  };

  const handleSkipPackage = () => {
    try {
      localStorage.removeItem("post_property_draft");
    } catch {}
    alert(
      "✅ Property submitted!\n\n⏳ Status: Pending Admin Approval.\n\nAapki listing admin verify hone ke baad hi live hogi.",
    );
    window.location.href = "/seller-dashboard";
  };

  /* ------------------------------
     UI text
  ------------------------------ */
  const stepTitles = [
    "Property Details",
    "Price & Location",
    "Specifications",
    "Photos",
    "Contact Information",
    "Summary",
  ];

  /* ------------------------------
     Auth gate
  ------------------------------ */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        Redirecting to login...
      </div>
    );
  }

  /* ------------------------------
     Package selection UI
  ------------------------------ */
  if (showPackageSelection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-4 py-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold mb-2 text-gray-900">
              📢 Boost Your Property Visibility
            </h2>
            <p className="text-gray-600 text-lg">
              Your property has been created successfully. Now choose how you
              want to list it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {FREE_LISTING_ENABLED && (
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6 flex flex-col">
                <div className="text-center mb-4">
                  <div className="inline-block bg-gray-100 p-3 rounded-full mb-3">
                    <Home className="h-8 w-8 text-gray-700" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Free Listing
                  </h3>
                </div>

                <div className="flex-1 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-gray-700">Listed on platform</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-gray-700">Standard visibility</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-gray-700">No additional cost</span>
                    </div>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    Requires admin approval
                  </p>
                </div>

                <Button
                  onClick={handleSkipPackage}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Continue with Free Listing (Pending Approval)
                </Button>
              </div>
            )}

            <div className="bg-white border-2 border-purple-400 rounded-lg p-6 flex flex-col relative">
              <div className="absolute top-3 right-3 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
                RECOMMENDED
              </div>

              <div className="text-center mb-4">
                <div className="inline-block bg-purple-100 p-3 rounded-full mb-3">
                  <PackageIcon className="h-8 w-8 text-purple-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Promotional Package
                </h3>
              </div>

              <div className="flex-1 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">Increased visibility</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">
                      Featured in search results
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-gray-700">
                      Attract more inquiries
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">
                  Select a package to proceed with payment
                </p>
              </div>

              <Button
                onClick={() => {
                  setTimeout(() => {
                    const packageEl =
                      document.getElementById("packages-section");
                    packageEl?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                View Packages →
              </Button>
            </div>
          </div>

          <div id="packages-section" className="mt-12">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">
              Available Packages
            </h3>
            <PackageSelection
              propertyId={propertyId!}
              onPackageSelect={handlePackageSelect}
            />
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  /* ------------------------------
     Payment UI
  ------------------------------ */
  if (showPaymentForm && selectedPackage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto p-4 py-8">
          <PaymentForm
            packageId={selectedPackage}
            propertyId={propertyId!}
            amount={selectedPackagePrice}
            packageName="Promotional Package"
            onPaymentComplete={handlePaymentComplete}
            onCancel={() => {
              setShowPaymentForm(false);
              setShowPackageSelection(true);
              setSelectedPackage(null);
              setSelectedPackagePrice(0);
            }}
          />
        </div>
        <BottomNavigation />
      </div>
    );
  }

  /* ------------------------------
     Main Wizard
  ------------------------------ */
  return (
    <div className="bg-gray-50 post-property-page overflow-x-hidden">
      <Header />

      <style>{`
        :root { --app-bottom-nav-height: 64px; }
        .post-property-page {
          min-height: var(--app-dvh, 100dvh);
          height: auto;
          padding-bottom: calc(var(--app-bottom-nav-height, 64px) + 112px) !important;
        }
        @supports (-webkit-touch-callout: none) {
          .post-property-page { min-height: 100svh; }
        }
        .wizard-actions {
          position: sticky;
          bottom: 0;
          background: #fff;
          box-shadow: 0 -2px 12px rgba(0,0,0,.08);
          padding: .75rem 1rem;
          display: flex;
          gap: .5rem;
          justify-content: space-between;
          z-index: 900;
        }
        @media (max-width: 1023px) {
          .wizard-actions {
            position: fixed;
            left: 0;
            right: 0;
            bottom: calc(var(--app-bottom-nav-height, 64px));
          }
        }
        @supports (-webkit-touch-callout: none) {
          .wizard-actions {
            bottom: calc(var(--app-bottom-nav-height, 64px) + env(safe-area-inset-bottom, 0px));
          }
        }
        @media (orientation: landscape) and (max-height: 480px) {
          :root { --app-bottom-nav-height: 48px; }
          .post-property-page {
            padding-bottom: calc(var(--app-bottom-nav-height, 48px) + 88px) !important;
          }
          .wizard-actions {
            padding: .5rem .75rem;
            gap: .4rem;
          }
          .wizard-actions button {
            padding: 6px 12px !important;
            font-size: 12px !important;
          }
          .pp-grid-2 { display: grid; grid-template-columns: 1fr !important; gap: .75rem !important; }
          .pp-grid-3 { display: grid; grid-template-columns: 1fr 1fr !important; gap: .75rem !important; }
          .uploaded-photos-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .compact-textarea { min-height: 80px !important; }
        }
        .z-raise { z-index: 10050; }
      `}</style>

      <div className="p-4">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-900">Post Property</h1>
            <span className="text-sm text-gray-600">
              Step {currentStep} of {stepTitles.length}
            </span>
          </div>
          <div className="flex space-x-2">
            {stepTitles.map((_, index) => (
              <div
                key={index}
                className={`flex-1 h-2 rounded-full ${
                  index + 1 <= currentStep ? "bg-[#C70000]" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mt-2">
            {stepTitles[currentStep - 1]}
          </h2>
        </div>

        {/* Free Ad Limit Status */}
        <FreeAdLimitStatus />

        {/* Step Content */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          {/* Step 1: Property Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g., 3 BHK Luxury Apartment in Sector 12"
                  className={!has(formData.title) ? "border-red-300" : ""}
                  required
                />
                {!has(formData.title) && (
                  <p className="text-red-500 text-xs mt-1">
                    Property title is required
                  </p>
                )}
              </div>

              {/* Property Type (Dynamic) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Type *
                </label>
                <Select
                  value={formData.propertyType}
                  onValueChange={(value) => {
                    handleInputChange("propertyType", value);
                    handleInputChange("subCategory", "");
                  }}
                >
                  <SelectTrigger
                    className={
                      !has(formData.propertyType) ? "border-red-300" : ""
                    }
                  >
                    <SelectValue
                      placeholder={
                        catLoading ? "Loading..." : "Select property type"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                    {catError && (
                      <div className="px-3 py-2 text-red-600 text-sm">
                        {catError}
                      </div>
                    )}
                    {!catLoading &&
                      categories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub Category (Dynamic) */}
              {formData.propertyType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub Category{" "}
                    {availableSubcats.length > 0 ? "*" : "(optional)"}
                  </label>
                  <Select
                    value={formData.subCategory}
                    onValueChange={(value) =>
                      handleInputChange("subCategory", value)
                    }
                  >
                    <SelectTrigger
                      className={
                        !has(formData.subCategory) &&
                        availableSubcats.length > 0
                          ? "border-red-300"
                          : ""
                      }
                    >
                      <SelectValue
                        placeholder={
                          availableSubcats.length
                            ? "Select sub category"
                            : "No subcategories"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      {availableSubcats.map((sub) => (
                        <SelectItem key={sub.slug} value={sub.slug}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!has(formData.subCategory) &&
                    availableSubcats.length > 0 && (
                      <p className="text-red-500 text-xs mt-1">
                        Please select a sub category
                      </p>
                    )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Describe your property in detail..."
                  className={`${!has(formData.description) ? "border-red-300" : ""} compact-textarea`}
                  rows={4}
                  required
                />
                {!has(formData.description) && (
                  <p className="text-red-500 text-xs mt-1">
                    Property description is required
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Price & Location */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pp-grid-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price *
                  </label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    placeholder="Enter price"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Type *
                  </label>
                  <Select
                    value={formData.priceType}
                    onValueChange={(value: "sale" | "rent") =>
                      handleInputChange("priceType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      <SelectItem value="sale">For Sale</SelectItem>
                      <SelectItem value="rent">For Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rohtak Area *
                </label>
                <Select
                  value={formData.location.area}
                  onValueChange={(value) =>
                    handleInputChange("location.area", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select area in Rohtak" />
                  </SelectTrigger>
                  <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                    {ROHTAK_AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complete Address
                </label>
                <Textarea
                  value={formData.location.address}
                  onChange={(e) =>
                    handleInputChange("location.address", e.target.value)
                  }
                  placeholder="House/Plot number, Street, Area, Rohtak, Haryana"
                  rows={3}
                  className="compact-textarea"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nearby Landmark
                </label>
                <Select
                  value={formData.location.landmark}
                  onValueChange={(value) =>
                    handleInputChange("location.landmark", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select nearby landmark" />
                  </SelectTrigger>
                  <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                    {getRohtakLandmarks().map((landmark) => (
                      <SelectItem key={landmark} value={landmark}>
                        {landmark}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Specifications */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pp-grid-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bedrooms
                  </label>
                  <Select
                    value={formData.specifications.bedrooms}
                    onValueChange={(value) =>
                      handleInputChange("specifications.bedrooms", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5+">5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text sm font-medium text-gray-700 mb-2">
                    Bathrooms
                  </label>
                  <Select
                    value={formData.specifications.bathrooms}
                    onValueChange={(value) =>
                      handleInputChange("specifications.bathrooms", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5+">5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Area (sq ft) *
                </label>
                <Input
                  type="number"
                  value={formData.specifications.area}
                  onChange={(e) =>
                    handleInputChange("specifications.area", e.target.value)
                  }
                  placeholder="e.g., 1200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pp-grid-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facing
                  </label>
                  <Select
                    value={formData.specifications.facing}
                    onValueChange={(value) =>
                      handleInputChange("specifications.facing", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      <SelectItem value="north">North</SelectItem>
                      <SelectItem value="south">South</SelectItem>
                      <SelectItem value="east">East</SelectItem>
                      <SelectItem value="west">West</SelectItem>
                      <SelectItem value="north-east">North-East</SelectItem>
                      <SelectItem value="north-west">North-West</SelectItem>
                      <SelectItem value="south-east">South-East</SelectItem>
                      <SelectItem value="south-west">South-West</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Furnished
                  </label>
                  <Select
                    value={formData.specifications.furnished}
                    onValueChange={(value) =>
                      handleInputChange("specifications.furnished", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      <SelectItem value="furnished">Furnished</SelectItem>
                      <SelectItem value="semi-furnished">
                        Semi-Furnished
                      </SelectItem>
                      <SelectItem value="unfurnished">Unfurnished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pp-grid-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Floor
                  </label>
                  <Input
                    value={formData.specifications.floor}
                    onChange={(e) =>
                      handleInputChange("specifications.floor", e.target.value)
                    }
                    placeholder="e.g., 2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Floors
                  </label>
                  <Input
                    value={formData.specifications.totalFloors}
                    onChange={(e) =>
                      handleInputChange(
                        "specifications.totalFloors",
                        e.target.value,
                      )
                    }
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parking
                  </label>
                  <Select
                    value={formData.specifications.parking}
                    onValueChange={(value) =>
                      handleInputChange("specifications.parking", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[10050] max-h-[60vh] overscroll-contain z-raise">
                      <SelectItem value="yes">Available</SelectItem>
                      <SelectItem value="no">Not Available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amenities
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    "Parking",
                    "Lift/Elevator",
                    "Security",
                    "Power Backup",
                    "Garden",
                    "Swimming Pool",
                    "Gym",
                    "Club House",
                    "Children's Play Area",
                    "24x7 Water Supply",
                    "Air Conditioning",
                    "Internet/WiFi Ready",
                    "Intercom",
                    "Rain Water Harvesting",
                    "Waste Management",
                  ].map((amenity) => (
                    <label
                      key={amenity}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="rounded border-gray-300 text-[#C70000] focus:ring-[#C70000]"
                      />
                      <span className="text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Photos */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Photos * (Max 10 images)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    Upload clear photos of your property
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="bg-[#C70000] text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-[#A60000]"
                  >
                    Choose Photos
                  </label>
                </div>
              </div>

              {formData.images.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Uploaded Photos ({formData.images.length}/10)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 uploaded-photos-grid">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Property ${index + 1}`}
                          className="w-full h-20 sm:h-24 md:h-28 object-cover rounded-lg border-2 border-gray-200 hover:border-[#C70000] transition-colors"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Contact Information */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person Name *
                </label>
                <Input
                  value={formData.contactInfo.name}
                  onChange={(e) =>
                    handleInputChange("contactInfo.name", e.target.value)
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <Input
                  value={formData.contactInfo.phone}
                  onChange={(e) =>
                    handleInputChange("contactInfo.phone", e.target.value)
                  }
                  placeholder="Enter primary phone number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alternative Mobile Number (Optional)
                </label>
                <Input
                  value={formData.contactInfo.alternativePhone || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "contactInfo.alternativePhone",
                      e.target.value,
                    )
                  }
                  placeholder="Enter alternative mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Number (Optional)
                </label>
                <Input
                  value={formData.contactInfo.whatsappNumber || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "contactInfo.whatsappNumber",
                      e.target.value,
                    )
                  }
                  placeholder="Enter WhatsApp number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <Input
                  type="email"
                  value={formData.contactInfo.email}
                  onChange={(e) =>
                    handleInputChange("contactInfo.email", e.target.value)
                  }
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 6: Summary */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Ready to Post!
                </h2>
                <p className="text-gray-600">
                  Review your property details and choose how to list it
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {formData.title}
                </h3>
                <p className="text-gray-600 mb-2">{formData.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm pp-grid-2">
                  <div>
                    <span className="font-medium">Price:</span> ₹
                    {Number(formData.price || 0).toLocaleString()}
                    {formData.priceType === "rent" && "/month"}
                  </div>
                  <div>
                    <span className="font-medium">Area:</span>{" "}
                    {formData.location.area}
                  </div>
                  <div>
                    <span className="font-medium">Size:</span>{" "}
                    {formData.specifications.area} sq ft
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {categoryLabel}
                  </div>
                  {has(formData.subCategory) && (
                    <div>
                      <span className="font-medium">Sub Type:</span>{" "}
                      {subCategoryLabel}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="w-full bg-[#C70000] hover:bg-[#A60000] text-white"
                >
                  {loading ? (
                    "Posting..."
                  ) : (
                    <>
                      <PackageIcon className="h-4 w-4 mr-2" />
                      Post with Promotion Package
                    </>
                  )}
                </Button>

                {FREE_LISTING_ENABLED && (
                  <Button
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      "Posting..."
                    ) : (
                      <>
                        <Home className="h-4 w-4 mr-2" />
                        Post as Free Listing (Pending Approval)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Wizard Actions */}
        <div id="wizard-actions" className="wizard-actions">
          <button
            id="btn-prev"
            aria-label="Previous"
            data-action="prev"
            data-testid="prev-step"
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            style={{
              padding: "8px 16px",
              backgroundColor: currentStep === 1 ? "#f3f4f6" : "#ffffff",
              color: currentStep === 1 ? "#9ca3af" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: currentStep === 1 ? "not-allowed" : "pointer",
            }}
          >
            Previous
          </button>

          <button
            id="btn-next"
            aria-label="Next"
            data-action="next"
            data-testid="next-step"
            onClick={handleNextStep}
            disabled={
              currentStep >= stepTitles.length || !validateStep(currentStep)
            }
            style={{
              padding: "8px 16px",
              backgroundColor:
                currentStep >= stepTitles.length || !validateStep(currentStep)
                  ? "#f3f4f6"
                  : "#C70000",
              color:
                currentStep >= stepTitles.length || !validateStep(currentStep)
                  ? "#9ca3af"
                  : "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor:
                currentStep >= stepTitles.length || !validateStep(currentStep)
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {currentStep >= stepTitles.length ? "Done" : "Next"}
          </button>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
