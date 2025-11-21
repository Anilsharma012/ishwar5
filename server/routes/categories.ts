// server/routes/categories.ts
import { RequestHandler } from "express";
import { getDatabase } from "../db/mongodb";
import { Category, ApiResponse } from "@shared/types";

// 🔐 Gate legacy seeding behind env (default: OFF)
const ALLOW_LEGACY_CATEGORY_INIT =
  process.env.ALLOW_LEGACY_CATEGORY_INIT === "true";

// Get all categories
export const getCategories: RequestHandler = async (req, res) => {
  try {
    let db;
    try {
      db = getDatabase();
    } catch {
      return res.status(503).json({
        success: false,
        error:
          "Database connection is being established. Please try again in a moment.",
      });
    }

    // Build query filter
    const filter: any = {};
    const orActive: any[] = [];

    // TYPE filter (default: property/null/undefined for backward compat)
    if (req.query.type) {
      filter.type = req.query.type;
    } else {
      filter.type = { $in: ["property", null, undefined] };
    }

    // ACTIVE filter (supports both 'active' and 'isActive')
    if (req.query.active !== undefined) {
      const val = req.query.active === "true";
      orActive.push({ active: val }, { isActive: val });
    }

    if (orActive.length) filter.$or = orActive;

    // Sort should respect both 'order' and 'sortOrder'
    // Mongo can't "ifNull" in sort directly here, so sort by both.
    const categories = await db
      .collection("categories")
      .find(filter)
      .sort({ order: 1, sortOrder: 1, name: 1 })
      .toArray();

    const response: ApiResponse<Category[]> = {
      success: true,
      data: categories as unknown as Category[],
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    });
  }
};

// Get category by slug
export const getCategoryBySlug: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const { slug } = req.params;

    // Prefer active categories but fall back to any
    let category = await db.collection("categories").findOne({
      slug,
      $or: [{ active: true }, { isActive: true }],
    });

    if (!category) {
      category = await db.collection("categories").findOne({ slug });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    const response: ApiResponse<Category> = {
      success: true,
      data: category as unknown as Category,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch category",
    });
  }
};

// Get subcategories by category slug
export const getSubcategories: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const { categorySlug } = req.query;

    if (!categorySlug) {
      return res.status(400).json({
        success: false,
        error: "categorySlug parameter is required",
      });
    }

    const category = await db
      .collection("categories")
      .findOne({ slug: categorySlug });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    let subcategories = Array.isArray(category.subcategories)
      ? category.subcategories
      : [];

    // filter active subcategories if requested
    if (req.query.active === "true") {
      subcategories = subcategories.filter((sub: any) => sub?.active !== false);
    }

    const response: ApiResponse<any[]> = {
      success: true,
      data: subcategories,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subcategories",
    });
  }
};

// Initialize default categories (LEGACY) — disabled unless explicitly allowed
export const initializeCategories: RequestHandler = async (req, res) => {
  try {
    if (!ALLOW_LEGACY_CATEGORY_INIT) {
      return res.json({
        success: true,
        message:
          "Legacy category initializer is disabled (ALLOW_LEGACY_CATEGORY_INIT=false).",
      });
    }

    const db = getDatabase();

    const existingCount = await db.collection("categories").countDocuments();
    if (existingCount > 0) {
      return res.json({
        success: true,
        message: "Categories already initialized",
      });
    }

    // ⚠️ If you ever enable this, keep the list minimal, or customize as needed.
    const defaultCategories: Omit<Category, "_id">[] = [
      {
        name: "Commercial",
        slug: "commercial",
        icon: "🏢",
        description: "Shops, offices, and commercial properties",
        subcategories: [
          { id: "shop", name: "Shop", slug: "shop", description: "Retail shops and stores" },
          { id: "office", name: "Office", slug: "office", description: "Office spaces" },
          { id: "warehouse", name: "Warehouse", slug: "warehouse", description: "Storage and warehouse facilities" },
        ],
        order: 2,
        active: true,
      },
      // keep other defaults out unless you need them
    ];

    // ensure unique slug index once
    try {
      await db.collection("categories").createIndex({ slug: 1 }, { unique: true });
    } catch {}

    await db.collection("categories").insertMany(defaultCategories);

    res.json({
      success: true,
      message: "Categories initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize categories",
    });
  }
};
