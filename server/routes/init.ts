// server/routes/init.ts
import { RequestHandler } from "express";
import { getDatabase } from "../db/mongodb";
import { User, AdPackage, ApiResponse } from "@shared/types";
import bcrypt from "bcrypt";

// -----------------------------------------------------------------------------
// CONFIG FLAGS
// -----------------------------------------------------------------------------
const SHOULD_SEED_PROPERTY_CATEGORIES =
  process.env.SEED_PROPERTY_CATEGORIES === "true";

// -----------------------------------------------------------------------------
// DB INDEXES (prevent duplicates)
// -----------------------------------------------------------------------------
async function ensureCategoryIndexes() {
  const db = getDatabase();
  try {
    await db.collection("categories").createIndex({ slug: 1 }, { unique: true });
  } catch (e) {
    // ignore if already exists
  }
}

// -----------------------------------------------------------------------------
// Category initialization (RUN ONLY WHEN FLAG ENABLED)
// -----------------------------------------------------------------------------
async function initializePropertyCategories() {
  if (!SHOULD_SEED_PROPERTY_CATEGORIES) {
    console.log("🏠 Category seeding skipped (SEED_PROPERTY_CATEGORIES=false)");
    return false;
  }

  const db = getDatabase();
  console.log("🏠 Initializing Property Categories (seeding enabled)...");

  // NOTE: Keep this list minimal; only if you truly want defaults.
  // You can freely edit or empty this array. With the ENV flag off,
  // nothing runs anyway.
  const categories = [
    {
      name: "Buy",
      slug: "buy",
      description: "Buy properties - apartments, houses, plots and more",
      propertyTypes: ["residential", "plot"],
      priceTypes: ["sale"],
      sortOrder: 1,
      isActive: true,
      subcategories: [
        { name: "1 BHK", slug: "1bhk" },
        { name: "2 BHK", slug: "2bhk" },
        { name: "3 BHK", slug: "3bhk" },
        { name: "4+ BHK", slug: "4bhk-plus" },
        { name: "Independent House", slug: "independent-house" },
        { name: "Villa", slug: "villa" },
        { name: "Builder Floor", slug: "builder-floor" },
        { name: "Plot/Land", slug: "plot" },
      ],
    },
    {
      name: "Rent",
      slug: "rent",
      description: "Rent properties - apartments, houses and more",
      propertyTypes: ["residential"],
      priceTypes: ["rent"],
      sortOrder: 2,
      isActive: true,
      subcategories: [
        { name: "1 BHK", slug: "1bhk" },
        { name: "2 BHK", slug: "2bhk" },
        { name: "3 BHK", slug: "3bhk" },
        { name: "4+ BHK", slug: "4bhk-plus" },
        { name: "Independent House", slug: "independent-house" },
      ],
    },
    {
      name: "Commercial",
      slug: "commercial",
      description: "Commercial properties",
      propertyTypes: ["commercial"],
      sortOrder: 3,
      isActive: true,
      subcategories: [
        { name: "Office Space", slug: "office-space" },
        { name: "Shop/Showroom", slug: "shop-showroom" },
        { name: "Warehouse", slug: "warehouse" },
      ],
    },

    // ⚠️ Intentionally NOT seeding PG/Hostel, PG/Co-living, Agricultural by default.
    // If you ever want them, add here OR turn flag on and reinitialize.
  ];

  try {
    await ensureCategoryIndexes();

    for (const categoryData of categories) {
      const existingCategory = await db
        .collection("categories")
        .findOne({ slug: categoryData.slug });

      const categoryDoc = {
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description,
        propertyTypes: categoryData.propertyTypes,
        priceTypes: categoryData.priceTypes,
        sortOrder: categoryData.sortOrder,
        active: categoryData.isActive,
        isActive: categoryData.isActive,
        subcategories: categoryData.subcategories,
        createdAt: existingCategory?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (existingCategory) {
        await db
          .collection("categories")
          .updateOne({ slug: categoryData.slug }, { $set: categoryDoc });
      } else {
        await db.collection("categories").insertOne(categoryDoc);
      }
    }

    console.log("✅ Property categories initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing categories:", error);
    return false;
  }
}

// -----------------------------------------------------------------------------
// Shared seeding logic
// -----------------------------------------------------------------------------
export async function seedDefaultData() {
  const db = getDatabase();
  console.log("🚀 Seeding default system data...");

  const resultSummary: any = {
    adminCreated: false,
    testUsersCreated: 0,
    packagesCreated: 0,
    categoriesCreated: false,
  };

  // 1) Admin user
  try {
    const existingAdmin = await db
      .collection("users")
      .findOne({ userType: "admin" });
    if (!existingAdmin) {
      console.log("📝 Creating default admin user...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const adminUser = {
        name: "Administrator",
        email: "admin@aashishproperty.com",
        phone: "+91 9876543210",
        password: hashedPassword,
        userType: "admin",
        status: "active",
        isVerified: true,
        preferences: {
          propertyTypes: [],
          priceRange: { min: 0, max: 10000000 },
          locations: [],
        },
        favorites: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection("users").insertOne(adminUser);
      resultSummary.adminCreated = true;
      console.log("✅ Admin user created");
    } else {
      console.log("✅ Admin already exists");
    }
  } catch (e: any) {
    console.error("Admin seeding error:", e?.message || e);
  }

  // 2) Test users
  try {
    const testUsers = [
      {
        name: "Test Seller",
        email: "seller@test.com",
        phone: "+91 9876543211",
        password: "password123",
        userType: "seller",
      },
      {
        name: "Test Buyer",
        email: "buyer@test.com",
        phone: "+91 9876543212",
        password: "password123",
        userType: "buyer",
      },
      {
        name: "Test Agent",
        email: "agent@test.com",
        phone: "+91 9876543213",
        password: "password123",
        userType: "agent",
      },
    ];

    for (const u of testUsers) {
      const exists = await db.collection("users").findOne({ email: u.email });
      if (!exists) {
        const hashed = await bcrypt.hash(u.password, 10);
        await db.collection("users").insertOne({
          ...u,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        resultSummary.testUsersCreated++;
      }
    }
    console.log(`✅ Test users created: ${resultSummary.testUsersCreated}`);
  } catch (e: any) {
    console.error("Test users seeding error:", e?.message || e);
  }

  // 3) Ad packages
  try {
    const existingPackages = await db
      .collection("ad_packages")
      .countDocuments();
    if (existingPackages === 0) {
      const defaultPackages = [
        {
          name: "Basic Listing",
          description: "Standard property listing with basic visibility",
          price: 0,
          duration: 30,
          features: ["30 days listing"],
          type: "basic",
          category: "property",
          location: "rohtak",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Featured Listing",
          description: "Enhanced visibility with featured badge",
          price: 299,
          duration: 30,
          features: ["Featured badge"],
          type: "featured",
          category: "property",
          location: "rohtak",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Premium Listing",
          description: "Maximum visibility with premium features",
          price: 599,
          duration: 30,
          features: ["Premium badge"],
          type: "premium",
          category: "property",
          location: "rohtak",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await db.collection("ad_packages").insertMany(defaultPackages);
      resultSummary.packagesCreated = defaultPackages.length;
      console.log("✅ Ad packages seeded");
    }
  } catch (e: any) {
    console.error("Ad packages seeding error:", e?.message || e);
  }

  // 4) Categories (flag-guarded)
  try {
    if (SHOULD_SEED_PROPERTY_CATEGORIES) {
      const categoriesInitialized = await initializePropertyCategories();
      resultSummary.categoriesCreated = !!categoriesInitialized;
    } else {
      console.log(
        "⏭️ Skipping category initialization (SEED_PROPERTY_CATEGORIES=false)"
      );
      resultSummary.categoriesCreated = false;
    }
  } catch (e: any) {
    console.error("Categories initialization error:", e?.message || e);
  }

  console.log("🎉 Seeding complete", resultSummary);
  return resultSummary;
}

// -----------------------------------------------------------------------------
// Debug: list all categories
// -----------------------------------------------------------------------------
export const debugCategories: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const categories = await db.collection("categories").find({}).toArray();

    res.json({
      success: true,
      count: categories.length,
      categories: categories.map((cat: any) => ({
        id: cat._id,
        name: cat.name,
        slug: cat.slug,
        isActive: cat.isActive ?? cat.active,
        subcategoriesCount: Array.isArray(cat.subcategories)
          ? cat.subcategories.length
          : 0,
        subcategories: cat.subcategories,
      })),
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    });
  }
};

// -----------------------------------------------------------------------------
// Force re-initialize categories (RESPECT FLAG)
// -----------------------------------------------------------------------------
export const reinitializeCategories: RequestHandler = async (req, res) => {
  try {
    if (!SHOULD_SEED_PROPERTY_CATEGORIES) {
      return res.json({
        success: true,
        message:
          "Category re-initialization disabled by config (SEED_PROPERTY_CATEGORIES=false)",
      });
    }
    const result = await initializePropertyCategories();
    res.json({
      success: result,
      message: result
        ? "Categories re-initialized successfully"
        : "Failed to re-initialize categories",
    });
  } catch (error) {
    console.error("Error re-initializing categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to re-initialize categories",
    });
  }
};

// -----------------------------------------------------------------------------
// Initialize entire system
// -----------------------------------------------------------------------------
export const initializeSystem: RequestHandler = async (req, res) => {
  try {
    const summary = await seedDefaultData();
    res.json({
      success: true,
      data: summary,
      message: "System initialized successfully",
    });
  } catch (error: any) {
    console.error("❌ Error initializing system:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to initialize system" });
  }
};
