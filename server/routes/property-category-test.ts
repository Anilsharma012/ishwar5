import { RequestHandler } from "express";
import { getDatabase } from "../db/mongodb";

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
  showroom: "commercial",
  office: "commercial",

  // Residential family
  residential: "residential",
  flat: "flat",
  apartment: "flat",

  // Plot
  plot: "plot",
};

/**
 * Test endpoint to check and fix property types
 * GET /api/admin/test-property-categories
 */
export const testPropertyCategories: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const propertiesCollection = db.collection("properties");

    console.log("🧪 Testing Property Category Filtering");
    console.log("=".repeat(60));

    // Test 1: Check for pg properties
    console.log("📋 TEST 1: Properties with propertyType='pg'");
    const pgProperties = await propertiesCollection
      .find({
        propertyType: "pg",
        status: "active",
        approvalStatus: "approved",
      })
      .limit(5)
      .toArray();

    console.log(`Found: ${pgProperties.length} properties`);

    // Test 2: Check for co-living properties (should be normalized to pg)
    console.log(
      "\n📋 TEST 2: Properties with propertyType='co-living' (legacy)",
    );
    const colivingLegacy = await propertiesCollection
      .find({
        propertyType: "co-living",
        status: "active",
        approvalStatus: "approved",
      })
      .toArray();

    console.log(`Found: ${colivingLegacy.length} properties`);

    // Test 3: Check for agricultural properties
    console.log("\n📋 TEST 3: Properties with propertyType='agricultural'");
    const agricProperties = await propertiesCollection
      .find({
        propertyType: "agricultural",
        status: "active",
        approvalStatus: "approved",
      })
      .limit(5)
      .toArray();

    console.log(`Found: ${agricProperties.length} properties`);

    // Test 4: Check property distribution by propertyType
    console.log("\n📋 TEST 4: Active & Approved Properties by Type");
    const propertyTypeCounts = await propertiesCollection
      .aggregate([
        {
          $match: { status: "active", approvalStatus: "approved" },
        },
        {
          $group: {
            _id: "$propertyType",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    // Test 5: Check subcategory distribution for PG
    console.log("\n📋 TEST 5: PG Properties by Subcategory");
    const pgSubcategoryCounts = await propertiesCollection
      .aggregate([
        {
          $match: {
            propertyType: "pg",
            status: "active",
            approvalStatus: "approved",
          },
        },
        {
          $group: {
            _id: "$subCategory",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    // Test 6: Check agricultural properties by subcategory
    console.log("\n📋 TEST 6: Agricultural Properties by Subcategory");
    const agricSubcategoryCounts = await propertiesCollection
      .aggregate([
        {
          $match: {
            propertyType: "agricultural",
            status: "active",
            approvalStatus: "approved",
          },
        },
        {
          $group: {
            _id: "$subCategory",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    // Test 7: Check for pending properties
    console.log("\n📋 TEST 7: Pending Properties (not yet visible)");
    const pendingCount = await propertiesCollection.countDocuments({
      $or: [{ status: "inactive" }, { approvalStatus: { $ne: "approved" } }],
    });

    const pendingExamples = await propertiesCollection
      .find({
        $or: [{ status: "inactive" }, { approvalStatus: { $ne: "approved" } }],
      })
      .limit(3)
      .toArray();

    res.json({
      success: true,
      data: {
        tests: {
          pgProperties: {
            count: pgProperties.length,
            examples: pgProperties.map((p: any) => ({
              title: p.title,
              propertyType: p.propertyType,
              subCategory: p.subCategory,
              status: p.status,
              approvalStatus: p.approvalStatus,
            })),
          },
          colivingLegacy: {
            count: colivingLegacy.length,
            warning:
              colivingLegacy.length > 0
                ? "Found legacy 'co-living' propertyType values"
                : "No legacy values found",
          },
          agricProperties: {
            count: agricProperties.length,
            examples: agricProperties.map((p: any) => ({
              title: p.title,
              propertyType: p.propertyType,
              subCategory: p.subCategory,
            })),
          },
          propertyTypeDistribution: propertyTypeCounts.map((item: any) => ({
            type: item._id || "null",
            count: item.count,
          })),
          pgBySubcategory: pgSubcategoryCounts.map((item: any) => ({
            subcategory: item._id || "null",
            count: item.count,
          })),
          agricBySubcategory: agricSubcategoryCounts.map((item: any) => ({
            subcategory: item._id || "null",
            count: item.count,
          })),
          pending: {
            count: pendingCount,
            examples: pendingExamples.map((p: any) => ({
              title: p.title,
              propertyType: p.propertyType,
              status: p.status,
              approvalStatus: p.approvalStatus,
            })),
          },
        },
      },
    });
  } catch (error) {
    console.error("❌ Error during testing:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
};

/**
 * Fix endpoint to normalize all property types
 * POST /api/admin/fix-property-categories
 */
export const fixPropertyCategories: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const propertiesCollection = db.collection("properties");

    console.log("🔧 Fixing property types...");
    console.log("=".repeat(60));

    // Get all properties
    const allProperties = await propertiesCollection.find({}).toArray();
    console.log(`📊 Found ${allProperties.length} total properties`);

    let fixedCount = 0;
    const fixes: any[] = [];

    for (const property of allProperties) {
      const originalPropertyType = property.propertyType;
      let normalizedPropertyType = (originalPropertyType || "")
        .trim()
        .toLowerCase();

      // Check if this propertyType needs to be normalized
      if (TYPE_ALIASES[normalizedPropertyType]) {
        const newPropertyType = TYPE_ALIASES[normalizedPropertyType];

        if (newPropertyType !== originalPropertyType) {
          fixes.push({
            propertyId: property._id,
            title: property.title,
            from: originalPropertyType,
            to: newPropertyType,
          });

          // Update the property
          await propertiesCollection.updateOne(
            { _id: property._id },
            { $set: { propertyType: newPropertyType } },
          );

          fixedCount++;
        }
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} properties`);

    res.json({
      success: true,
      data: {
        totalProperties: allProperties.length,
        fixedCount,
        fixes: fixes.slice(0, 20), // Return first 20 fixes
        totalFixes: fixes.length,
        message: `Fixed ${fixedCount} out of ${allProperties.length} properties`,
      },
    });
  } catch (error) {
    console.error("❌ Error fixing property types:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
};
