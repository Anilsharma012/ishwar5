// server/routes/properties.ts
import { RequestHandler } from "express";
import { getDatabase } from "../db/mongodb";
import { Property, ApiResponse } from "@shared/types";
import { ObjectId } from "mongodb";
import multer, { FileFilterCallback } from "multer";
import path from "path";

import fs from "fs";
import {
  sendPropertyConfirmationEmail,
  sendPropertyApprovalEmail,
  sendEmail,
} from "../utils/mailer";

/* =========================================================================
   Multer (image uploads)
   ========================================================================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads", "properties");
    if (!fs.existsSync(uploadPath))
      fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`,
    );
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: any, file, cb: FileFilterCallback) => {
    if (file.mimetype?.startsWith?.("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

/* =========================================================================
   Helpers
   ========================================================================= */
const toInt = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

// Slug synonyms so PG/Co-living etc. work across seeds & UI
const CAT_SYNONYMS: Record<string, string[]> = {
  "co-living": ["co-living", "coliving", "pg-co-living", "pg"],
  pg: ["pg", "pg-hostel", "pg/hostel", "pg-co-living", "co-living"],
  // add more if needed:
  // "buy": ["buy"],
  // "rent": ["rent"],
};

function normSlug(v: any): string {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function expandCategory(cat: string): string[] {
  const s = normSlug(cat);
  return CAT_SYNONYMS[s] || (s ? [s] : []);
}

/* =========================================================================
   PUBLIC: Generic listing (supports many query aliases)
   ========================================================================= */
/**
 * Public listing:
 * - Only ACTIVE + APPROVED
 * - Accepts multiple aliases: category|categorySlug|propertyType, sub|subCategory|subcategory
 * - Normalizes PG/Co-living synonyms
 */
export const getProperties: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();

    // Raw query
    const {
      propertyType: qPropertyType,
      subCategory,
      priceType,
      category: qCategory,
      sector,
      mohalla,
      landmark,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      minArea,
      maxArea,
      sortBy = "date_desc",
      page = "1",
      limit = "20",
    } = req.query;

    // --- 1) Normalize slugs/aliases coming from UI ---
    const norm = (v?: any) =>
      String(v ?? "")
        .trim()
        .toLowerCase();
    const category = norm(qCategory);
    let propertyType = norm(qPropertyType);

    // Map UI aliases → canonical DB values
    const TYPE_ALIASES: Record<string, string> = {
      // PG / Co-living
      "co-living": "pg",
      coliving: "pg",
      pg: "pg",

      // Agricultural
      "agricultural-land": "agricultural",
      agri: "agricultural",
      agricultural: "agricultural",

      // Commercial family
      commercial: "commercial",
      showroom: "commercial", // sometimes treated as category in UI
      office: "commercial",

      // Residential family
      residential: "residential",
      flat: "flat", // you use a separate "flat" type in DB
      apartment: "flat", // alias just in case

      // Plot
      plot: "plot",
    };

    // If page passed only `category`, derive propertyType from it
    if (!propertyType && category && TYPE_ALIASES[category]) {
      propertyType = TYPE_ALIASES[category];
    }
    // If page passed a propertyType alias, normalize it
    if (propertyType && TYPE_ALIASES[propertyType]) {
      propertyType = TYPE_ALIASES[propertyType];
    }

    // --- 2) Base moderation filter (public) ---
    const filter: any = {
      status: "active",
      $or: [
        { approvalStatus: "approved" },
        { approvalStatus: { $exists: false } },
      ],
    };

    // --- 3) “Buy/Rent” top tabs logic (broad groupings) ---
    // If the page is one of the top tabs, prefer this grouping,
    // but keep normalized propertyType if it was explicitly sent.
    switch (category) {
      case "buy":
        // show sale listings in residential AND plot
        filter.$or = [
          { propertyType: "residential", priceType: "sale" },
          { propertyType: "plot", priceType: "sale" },
          { propertyType: "flat", priceType: "sale" }, // include flats when buying
        ];
        break;
      case "rent":
        filter.$or = [
          { propertyType: "residential", priceType: "rent" },
          { propertyType: "flat", priceType: "rent" },
          { propertyType: "commercial", priceType: "rent" }, // many want commercial rentals too
        ];
        break;
      default:
        // If not in buy/rent tabs, and we have a normalized propertyType, use it
        if (propertyType) {
          filter.propertyType = propertyType;
        }
        break;
    }

    console.log("🔍 FILTER PROPERTIES → query", {
      category,
      propertyType,
      subCategory: norm(subCategory),
      filter: JSON.stringify(filter, null, 2),
    });

    // --- 4) Sub-category and other filters ---
    if (subCategory) filter.subCategory = norm(subCategory);
    if (priceType) filter.priceType = norm(priceType);
    if (sector) filter["location.sector"] = norm(sector);
    if (mohalla) filter["location.mohalla"] = norm(mohalla);
    if (landmark) filter["location.landmark"] = norm(landmark);

    if (bedrooms) {
      const b = String(bedrooms);
      if (b === "4+") filter["specifications.bedrooms"] = { $gte: 4 };
      else {
        const n = parseInt(b, 10);
        if (!Number.isNaN(n)) filter["specifications.bedrooms"] = n;
      }
    }
    if (bathrooms) {
      const n = parseInt(String(bathrooms), 10);
      if (!Number.isNaN(n)) filter["specifications.bathrooms"] = n;
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(String(minPrice), 10);
      if (maxPrice) filter.price.$lte = parseInt(String(maxPrice), 10);
    }
    if (minArea || maxArea) {
      filter["specifications.area"] = {};
      if (minArea)
        filter["specifications.area"].$gte = parseInt(String(minArea), 10);
      if (maxArea)
        filter["specifications.area"].$lte = parseInt(String(maxArea), 10);
    }

    // --- 5) Sorting / Pagination unchanged ---
    const sort: any = {};
    switch (sortBy) {
      case "price_asc":
        sort.price = 1;
        break;
      case "price_desc":
        sort.price = -1;
        break;
      case "area_desc":
        sort["specifications.area"] = -1;
        break;
      case "date_asc":
        sort.createdAt = 1;
        break;
      default:
        sort.createdAt = -1;
    }

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;

    const properties = await db
      .collection("properties")
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const total = await db.collection("properties").countDocuments(filter);

    res.json({
      success: true,
      data: {
        properties: properties as unknown as Property[],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch properties" });
  }
};

/* =========================================================================
   PUBLIC: Category page with path params (/categories/:category/:sub?)
   ========================================================================= */
export const listPublicPropertiesByCategory: RequestHandler = async (
  req,
  res,
) => {
  try {
    // Reuse getProperties logic by mapping params → query and calling same code path
    req.query = {
      ...req.query,
      category: req.params.category, // e.g. "co-living"
      subCategory: req.params.sub || req.params.subcategory || "",
    };
    // @ts-ignore - call same handler
    return getProperties(req, res);
  } catch (err) {
    console.error("listPublicPropertiesByCategory error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to list properties" });
  }
};

/* =========================================================================
   PUBLIC: Get by ID
   ========================================================================= */
export const getPropertyById: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res
        .status(400)
        .json({ success: false, error: "Invalid property ID" });

    const property = await db
      .collection("properties")
      .findOne({ _id: new ObjectId(id) });
    if (!property)
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });

    await db
      .collection("properties")
      .updateOne({ _id: new ObjectId(id) }, { $inc: { views: 1 } });

    const response: ApiResponse<Property> = {
      success: true,
      data: property as unknown as Property,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ success: false, error: "Failed to fetch property" });
  }
};

/* =========================================================================
   CREATE: FREE / pre-PAID (ALWAYS pending)
   ========================================================================= */
export const createProperty: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = (req as any).userId;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "User not authenticated" });

    // images
    const images: string[] = [];
    if (Array.isArray((req as any).files)) {
      (req as any).files.forEach((file: any) =>
        images.push(`/uploads/properties/${file.filename}`),
      );
    }

    // safe parse
    const safeParse = <T = any>(v: any, fallback: any = {}): T => {
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return fallback;
        }
      }
      return (v ?? fallback) as T;
    };
    const location = safeParse(req.body.location, {});
    const specifications = safeParse(req.body.specifications, {});
    const amenities = safeParse(req.body.amenities, []);
    const contactInfo = safeParse(req.body.contactInfo, {});

    const providedPremium = req.body.premium === "true";
    const contactVisibleFlag =
      typeof req.body.contactVisible === "string"
        ? req.body.contactVisible === "true"
        : !!req.body.contactVisible;

    const packageId: string | undefined =
      typeof req.body.packageId === "string" && req.body.packageId.trim()
        ? req.body.packageId.trim()
        : undefined;

    // moderation defaults
    const approvalStatus: "pending" | "pending_approval" = packageId
      ? "pending_approval"
      : "pending";
    const status: "inactive" | "active" = "inactive"; // 🔒 NEVER live at creation

    // Map UI aliases to canonical DB values (same as query-time mapping)
    const TYPE_ALIASES: Record<string, string> = {
      "co-living": "pg",
      coliving: "pg",
      pg: "pg",
      "agricultural-land": "agricultural",
      agri: "agricultural",
      agricultural: "agricultural",
      commercial: "commercial",
      showroom: "commercial",
      office: "commercial",
      residential: "residential",
      flat: "flat",
      apartment: "flat",
      plot: "plot",
    };

    // Normalize propertyType
    let normalizedPropertyType = normSlug(req.body.propertyType);
    if (TYPE_ALIASES[normalizedPropertyType]) {
      normalizedPropertyType = TYPE_ALIASES[normalizedPropertyType];
    }

    const propertyData: Omit<Property, "_id"> & {
      packageId?: string;
      isApproved?: boolean;
      approvedBy?: string;
      rejectionReason?: string;
      adminComments?: string;
      isPaid?: boolean;
      paymentStatus?: "unpaid" | "paid" | "failed";
      lastPaymentAt?: Date | null;
      package?: any;
      packageExpiry?: Date | null;
    } = {
      title: req.body.title,
      description: req.body.description,
      price: toInt(req.body.price) ?? 0,
      priceType: req.body.priceType,
      propertyType: normalizedPropertyType,
      subCategory: normSlug(req.body.subCategory),
      location,
      specifications: {
        ...specifications,
        bedrooms: toInt(specifications.bedrooms),
        bathrooms: toInt(specifications.bathrooms),
        area: toInt(specifications.area),
        floor: toInt(specifications.floor),
        totalFloors: toInt(specifications.totalFloors),
        parking:
          typeof specifications.parking === "string"
            ? specifications.parking === "yes"
            : !!specifications.parking,
      },
      images,
      amenities: Array.isArray(amenities) ? amenities : [],
      ownerId: String(userId),
      ownerType: (req as any).userType || "seller",
      contactInfo,

      // 🔒 moderation enforced
      status,
      approvalStatus,
      isApproved: false,
      featured: false,
      premium: providedPremium || !!packageId,
      contactVisible: contactVisibleFlag,

      // payment defaults
      isPaid: false,
      paymentStatus: "unpaid",
      lastPaymentAt: null,
      package: null,
      packageExpiry: null,

      views: 0,
      inquiries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(packageId ? { packageId } : {}),
    };

    console.log("📥 CREATE PROPERTY → enforced", {
      title: propertyData.title,
      propertyType: propertyData.propertyType,
      subCategory: propertyData.subCategory,
      status: propertyData.status,
      approvalStatus: propertyData.approvalStatus,
      isApproved: propertyData.isApproved,
      premium: propertyData.premium,
      packageId: propertyData.packageId || null,
    });

    // Free post limit enforcement - get settings from database
    let freeAdSettings: any = await db
      .collection("free_ad_settings")
      .findOne({ _id: "default" });

    if (!freeAdSettings) {
      freeAdSettings = {
        maxFreeAdsPerMonth: process.env.FREE_POST_LIMIT
          ? Number(process.env.FREE_POST_LIMIT)
          : 5,
        numberOfDays: process.env.FREE_POST_PERIOD_DAYS
          ? Number(process.env.FREE_POST_PERIOD_DAYS)
          : 30,
        isActive: true,
      };
    }

    if (freeAdSettings.isActive && !propertyData.packageId) {
      const periodStart = new Date(
        Date.now() - freeAdSettings.numberOfDays * 24 * 60 * 60 * 1000,
      );
      const userIdStr = String(userId);
      const freePostsCount = await db.collection("properties").countDocuments({
        ownerId: userIdStr,
        createdAt: { $gte: periodStart },
        $or: [
          { packageId: { $exists: false } },
          { packageId: null },
          { isPaid: false },
        ],
      });

      if (freePostsCount >= freeAdSettings.maxFreeAdsPerMonth) {
        return res.status(403).json({
          success: false,
          error: `Free listing limit reached: You can post ${freeAdSettings.maxFreeAdsPerMonth} free ads every ${freeAdSettings.numberOfDays} days. Please upgrade to a paid package to post more.`,
          limitReached: true,
          freeAdLimit: {
            max: freeAdSettings.maxFreeAdsPerMonth,
            days: freeAdSettings.numberOfDays,
            used: freePostsCount,
          },
        });
      }
    }

    const result = await db.collection("properties").insertOne(propertyData);
    const propertyId = result.insertedId.toString();

    // ✅ user confirmation email (best-effort)
    try {
      const user = await db
        .collection("users")
        .findOne({ _id: new ObjectId(String(userId)) });
      if (user?.email) {
        await sendPropertyConfirmationEmail(
          user.email,
          user.name || "User",
          propertyData.title,
          propertyId,
        );
      }
    } catch (e) {
      console.warn(
        "Property confirmation email failed:",
        (e as any)?.message || e,
      );
    }

    // ✅ admin notification email (best-effort)
    (async () => {
      try {
        // Resolve admin email from settings or env
        const adminSettings = await db.collection("admin_settings").findOne({});
        const adminEmail =
          adminSettings?.contact?.email ||
          adminSettings?.general?.contactEmail ||
          adminSettings?.email?.fromEmail ||
          process.env.ADMIN_EMAIL ||
          "admin@ashishproperties.in";

        // Owner details
        const owner = await db
          .collection("users")
          .findOne({ _id: new ObjectId(String(userId)) });

        const ownerName = owner?.name || "User";
        const ownerEmail = owner?.email || "";
        const ownerPhone = owner?.phone || "";

        const textSummary = [
          `New Property Submitted`,
          `Title: ${propertyData.title}`,
          `Type: ${propertyData.propertyType || "-"}`,
          `Price: ${propertyData.price ? `₹${propertyData.price}` : "-"}`,
          `City: ${(propertyData as any)?.location?.city || "-"}`,
          `Area: ${(propertyData as any)?.location?.area || "-"}`,
          `Owner: ${ownerName} ${ownerPhone ? `(${ownerPhone})` : ""}`,
          ownerEmail ? `Email: ${ownerEmail}` : "",
          `Property ID: ${propertyId}`,
          `Posted At: ${new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}`,
        ]
          .filter(Boolean)
          .join("\n");

        const adminEmailHTML = `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#f7f7f7; border:1px solid #eee;">
            <div style="background: linear-gradient(135deg, #C70000 0%, #8B0000 100%); padding: 18px 22px; color:#fff;">
              <h2 style="margin:0;">🆕 New Property Submitted</h2>
              <p style="margin:6px 0 0 0; opacity:.9;">A user has posted a new property. Please review & approve/reject.</p>
            </div>

            <div style="padding: 20px 22px; background:#fff;">
              <h3 style="margin:0 0 12px 0; color:#222;">Property Details</h3>
              <table cellpadding="6" style="width:100%; border-collapse:collapse;">
                <tr><td style="width:160px; color:#555;">Title</td><td><strong>${propertyData.title}</strong></td></tr>
                <tr><td style="color:#555;">Type</td><td>${propertyData.propertyType || "-"}</td></tr>
                <tr><td style="color:#555;">Price</td><td>${propertyData.price ? "₹" + propertyData.price : "-"}</td></tr>
                <tr><td style="color:#555;">City</td><td>${(propertyData as any)?.location?.city || "-"}</td></tr>
                <tr><td style="color:#555;">Area</td><td>${(propertyData as any)?.location?.area || "-"}</td></tr>
                <tr><td style="color:#555;">Property ID</td><td>${propertyId}</td></tr>
                <tr><td style="color:#555;">Posted At</td><td>${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>
              </table>

              <h3 style="margin:18px 0 8px; color:#222;">Owner</h3>
              <table cellpadding="6" style="width:100%; border-collapse:collapse;">
                <tr><td style="width:160px; color:#555;">Name</td><td>${ownerName}</td></tr>
                <tr><td style="color:#555;">Phone</td><td>${ownerPhone || "-"}</td></tr>
                <tr><td style="color:#555;">Email</td><td>${ownerEmail || "-"}</td></tr>
              </table>

              <div style="margin-top:18px; padding:12px 14px; background:#fff3cd; border-left:4px solid #C70000; color:#6b4a00;">
                <b>Next:</b> Admin Panel → Properties → Review & Approve/Reject this listing.
              </div>
            </div>

            <div style="background:#333; color:#fff; text-align:center; padding:10px;">
              <small>Ashish Properties • Admin Notification</small>
            </div>
          </div>
        `;

        await sendEmail(
          adminEmail,
          `New Property Submitted: ${propertyData.title}`,
          adminEmailHTML,
          textSummary,
        );

        console.log(
          "📧 Admin notified for new property:",
          propertyId,
          "→",
          adminEmail,
        );
      } catch (err) {
        console.warn(
          "Admin notification email (new property) failed:",
          (err as any)?.message || err,
        );
      }
    })();

    const response: ApiResponse<{ _id: string }> = {
      success: true,
      data: { _id: propertyId },
      message:
        "Property submitted. ⏳ Pending Admin Approval. Paid listings go live only after payment verification + admin approval.",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating property:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create property" });
  }
};

/* =========================================================================
   PUBLIC: Featured
   ========================================================================= */
export const getFeaturedProperties: RequestHandler = async (_req, res) => {
  try {
    const db = getDatabase();
    const properties = await db
      .collection("properties")
      .find({ status: "active", featured: true, approvalStatus: "approved" })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const response: ApiResponse<Property[]> = {
      success: true,
      data: properties as unknown as Property[],
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching featured properties:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch featured properties" });
  }
};

/* =========================================================================
   USER Dashboard: My Properties
   ========================================================================= */
export const getUserProperties: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const userId = (req as any).userId;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "User not authenticated" });

    const properties = await db
      .collection("properties")
      .find({ ownerId: String(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    const response: ApiResponse<Property[]> = {
      success: true,
      data: properties as unknown as Property[],
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching user properties:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch user properties" });
  }
};

/* =========================================================================
   USER Notifications
   ========================================================================= */
export const getUserNotifications: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const userType = (req as any).userType;
    const db = getDatabase();

    const userIdObj = new ObjectId(String(userId));

    // Fetch user notifications
    const userNotifications = await db
      .collection("user_notifications")
      .find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .toArray();

    // If seller/agent/admin, also fetch seller notifications
    let sellerNotifications: any[] = [];
    if (["seller", "agent", "admin"].includes(String(userType || ""))) {
      sellerNotifications = await db
        .collection("notifications")
        .find({ sellerId: userIdObj })
        .sort({ createdAt: -1 })
        .toArray();
    }

    // Add source field to indicate which collection each notification came from
    const userNotifsWithSource = userNotifications.map((n) => ({
      ...n,
      _notificationSource: "user_notifications",
    }));
    const sellerNotifsWithSource = sellerNotifications.map((n) => ({
      ...n,
      _notificationSource: "notifications",
    }));

    // Merge and sort by creation date
    const allNotifications = [
      ...userNotifsWithSource,
      ...sellerNotifsWithSource,
    ].sort(
      (a, b) =>
        new Date(b.createdAt || b.sentAt).getTime() -
        new Date(a.createdAt || a.sentAt).getTime(),
    );

    res.json({ success: true, data: allNotifications });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch notifications" });
  }
};

export const markUserNotificationAsRead: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { notificationId } = req.params;
    const db = getDatabase();

    if (!ObjectId.isValid(String(notificationId))) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid notification ID" });
    }

    await db.collection("user_notifications").updateOne(
      {
        _id: new ObjectId(String(notificationId)),
        userId: new ObjectId(String(userId)),
      },
      { $set: { isRead: true, readAt: new Date() } },
    );

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to mark notification as read" });
  }
};

export const deleteUserNotification: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { notificationId } = req.params;
    const db = getDatabase();

    if (!ObjectId.isValid(String(notificationId))) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid notification ID" });
    }

    await db.collection("user_notifications").deleteOne({
      _id: new ObjectId(String(notificationId)),
      userId: new ObjectId(String(userId)),
    });

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete notification" });
  }
};

/* =========================================================================
   ADMIN: Pending list
   ========================================================================= */
export const getPendingProperties: RequestHandler = async (_req, res) => {
  try {
    const db = getDatabase();
    const properties = await db
      .collection("properties")
      .find({ approvalStatus: { $in: ["pending", "pending_approval"] } })
      .sort({ createdAt: -1 })
      .toArray();

    const response: ApiResponse<Property[]> = {
      success: true,
      data: properties as unknown as Property[],
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching pending properties:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch pending properties" });
  }
};

/* =========================================================================
   ADMIN: Approve / Reject
   ========================================================================= */
export const updatePropertyApproval: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();

    // accept both :propertyId and :id (safe for your existing routes)
    const { propertyId, id } = req.params as {
      propertyId?: string;
      id?: string;
    };
    const paramId = (propertyId || id || "").trim();

    const { approvalStatus, adminComments, rejectionReason } = req.body as {
      approvalStatus: "approved" | "rejected";
      adminComments?: string;
      rejectionReason?: string;
    };

    const adminId = (req as any).userId;

    // ---- validations
    if (!paramId || !ObjectId.isValid(paramId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid property ID" });
    }

    if (!["approved", "rejected"].includes(String(approvalStatus))) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid approval status" });
    }

    const _id = new ObjectId(paramId);

    // ---- get property
    const property = await db.collection("properties").findOne({ _id });
    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    // ---- prepare update
    const now = new Date();
    const updateData: any = {
      approvalStatus,
      updatedAt: now,
    };

    if (approvalStatus === "approved") {
      updateData.status = "active";
      updateData.isApproved = true;
      updateData.approvedAt = now;
      updateData.approvedBy = String(adminId || "");
      // clean any previous rejection reason
      updateData.rejectionReason = undefined;
    } else {
      updateData.status = "inactive";
      updateData.isApproved = false;
      if (rejectionReason) updateData.rejectionReason = rejectionReason;
      updateData.approvedAt = undefined;
      updateData.approvedBy = undefined;
    }

    if (adminComments) updateData.adminComments = adminComments;

    // ---- save
    await db.collection("properties").updateOne({ _id }, { $set: updateData });

    // ---- notify owner (best-effort)
    try {
      // ownerId might be string or ObjectId in your data
      let ownerId: ObjectId | null = null;
      try {
        ownerId = new ObjectId(String(property.ownerId));
      } catch {
        ownerId = null;
      }

      const owner = ownerId
        ? await db.collection("users").findOne({ _id: ownerId })
        : null;

      if (owner?.email) {
        await sendPropertyApprovalEmail(
          owner.email, // to
          owner.name || "User", // name
          property.title || "Your Property", // property title
          String(property._id), // property id
          approvalStatus === "approved", // isApproved boolean
          approvalStatus === "rejected"
            ? rejectionReason || updateData.rejectionReason || undefined
            : undefined,
        );
      }
    } catch (e) {
      console.warn("Approval email failed:", (e as any)?.message || e);
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: `Property ${approvalStatus} successfully` },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating property approval:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update property approval" });
  }
};
