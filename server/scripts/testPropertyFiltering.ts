#!/usr/bin/env tsx
/**
 * Test script to verify that properties are correctly filtered by category/subcategory
 * This helps diagnose why properties aren't showing in their categories
 */

import { connectToDatabase, closeDatabaseConnection } from "../db/mongodb";

interface PropertySample {
  _id: string;
  title: string;
  propertyType: string;
  subCategory: string;
  status: string;
  approvalStatus: string;
}

async function testPropertyFiltering() {
  console.log("🧪 Testing Property Category Filtering");
  console.log("=".repeat(60));

  try {
    const { db } = await connectToDatabase();
    console.log("✅ Connected to MongoDB\n");

    const propertiesCollection = db.collection("properties");

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
    pgProperties.forEach((prop: PropertySample) => {
      console.log(
        `  ✓ "${prop.title}" | subCategory: "${prop.subCategory}"`
      );
    });

    // Test 2: Check for co-living properties (should be normalized to pg)
    console.log("\n📋 TEST 2: Properties with propertyType='co-living' (legacy)");
    const colivingLegacy = await propertiesCollection
      .find({
        propertyType: "co-living",
        status: "active",
        approvalStatus: "approved",
      })
      .limit(5)
      .toArray();

    console.log(`Found: ${colivingLegacy.length} properties`);
    if (colivingLegacy.length > 0) {
      console.log("  ⚠️  Warning: Found legacy 'co-living' propertyType values");
      console.log("      These should be normalized to 'pg'");
      colivingLegacy.forEach((prop: PropertySample) => {
        console.log(
          `  ! "${prop.title}" | subCategory: "${prop.subCategory}"`
        );
      });
    }

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
    agricProperties.forEach((prop: PropertySample) => {
      console.log(
        `  ✓ "${prop.title}" | subCategory: "${prop.subCategory}"`
      );
    });

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

    if (propertyTypeCounts.length === 0) {
      console.log("  ℹ️  No active, approved properties found");
    } else {
      propertyTypeCounts.forEach((item: any) => {
        console.log(`  ${item._id || "null"}: ${item.count} properties`);
      });
    }

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

    if (pgSubcategoryCounts.length === 0) {
      console.log("  ℹ️  No PG properties found");
    } else {
      pgSubcategoryCounts.forEach((item: any) => {
        console.log(`  ${item._id || "null"}: ${item.count} properties`);
      });
    }

    // Test 6: Check for pending properties
    console.log("\n📋 TEST 6: Pending Properties (not yet visible)");
    const pendingCount = await propertiesCollection.countDocuments({
      $or: [{ status: "inactive" }, { approvalStatus: { $ne: "approved" } }],
    });
    console.log(`Found: ${pendingCount} pending/inactive properties`);

    const pendingExamples = await propertiesCollection
      .find({
        $or: [{ status: "inactive" }, { approvalStatus: { $ne: "approved" } }],
      })
      .limit(3)
      .toArray();

    pendingExamples.forEach((prop: PropertySample) => {
      console.log(
        `  - "${prop.title}" | status: ${prop.status}, approval: ${prop.approvalStatus}`
      );
    });

    console.log("\n✨ Test complete!");
  } catch (error) {
    console.error("❌ Error during testing:", error);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

testPropertyFiltering().then(() => {
  process.exit(0);
});
