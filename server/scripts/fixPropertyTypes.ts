#!/usr/bin/env tsx
/**
 * Fix existing properties with non-normalized propertyType values
 * This script normalizes all property types using the same TYPE_ALIASES
 * that are used during creation and querying
 * 
 * Run with: tsx server/scripts/fixPropertyTypes.ts
 */

import { connectToDatabase, closeDatabaseConnection } from "../db/mongodb";

const TYPE_ALIASES: Record<string, string> = {
  // PG / Co-living
  "co-living": "pg",
  "coliving": "pg",
  "pg": "pg",

  // Agricultural
  "agricultural-land": "agricultural",
  "agri": "agricultural",
  "agricultural": "agricultural",

  // Commercial family
  "commercial": "commercial",
  "showroom": "commercial",
  "office": "commercial",

  // Residential family
  "residential": "residential",
  "flat": "flat",
  "apartment": "flat",

  // Plot
  "plot": "plot",
};

async function fixPropertyTypes() {
  console.log("🔧 Fixing property types...");
  console.log("=".repeat(60));

  try {
    const { db } = await connectToDatabase();
    console.log("✅ Connected to MongoDB");

    const propertiesCollection = db.collection("properties");

    // Get all properties
    const allProperties = await propertiesCollection.find({}).toArray();
    console.log(`📊 Found ${allProperties.length} total properties`);

    let fixedCount = 0;
    const fixes: any[] = [];

    for (const property of allProperties) {
      const originalPropertyType = property.propertyType;
      let normalizedPropertyType = (originalPropertyType || "").trim().toLowerCase();

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
            { $set: { propertyType: newPropertyType } }
          );

          fixedCount++;
        }
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} properties`);

    if (fixedCount > 0) {
      console.log("\n📋 Fixed properties:");
      fixes.forEach((fix) => {
        console.log(
          `  - ${fix.title} (${fix.propertyId}): "${fix.from}" → "${fix.to}"`
        );
      });
    }

    console.log("\n✨ Property type fix complete!");
  } catch (error) {
    console.error("❌ Error fixing property types:", error);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

fixPropertyTypes().then(() => {
  process.exit(0);
});
