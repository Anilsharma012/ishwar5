import { connectToDatabase } from "../db/mongodb";
import { ObjectId } from "mongodb";

async function setupPGCoLiving() {
  console.log("🏨 Setting up PG/CO-Living category with subcategories...");
  console.log("=".repeat(60));

  try {
    const { db } = await connectToDatabase();

    // 1. Create or get PG/CO-Living category
    console.log("\n📂 Creating/updating PG/CO-Living category...");

    const pgCoLivingData = {
      name: "PG/CO-Living",
      slug: "pg-co-living",
      iconUrl: "🏨",
      description: "Paying guest and co-living accommodations",
      sortOrder: 6,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existingCategory = await db
      .collection("categories")
      .findOne({ slug: "pg-co-living" });

    let categoryId: string;

    if (existingCategory) {
      console.log("   ✅ Category already exists");
      categoryId = existingCategory._id.toString();
      await db
        .collection("categories")
        .updateOne(
          { _id: existingCategory._id },
          { $set: { ...pgCoLivingData, updatedAt: new Date() } },
        );
    } else {
      const result = await db
        .collection("categories")
        .insertOne(pgCoLivingData);
      categoryId = result.insertedId.toString();
      console.log(`   ✅ Created new category with ID: ${categoryId}`);
    }

    // 2. Define subcategories for PG/CO-Living
    const subcategories = [
      {
        name: "Shared Room",
        slug: "shared-room",
        description: "Share a room with one or more roommates",
        sortOrder: 1,
      },
      {
        name: "Individual Room",
        slug: "individual-room",
        description: "Single occupancy private room",
        sortOrder: 2,
      },
      {
        name: "Studio Apartment",
        slug: "studio-apartment",
        description: "Compact studio apartment with living space",
        sortOrder: 3,
      },
    ];

    // 3. Create subcategories
    console.log("\n📋 Creating subcategories...");

    for (const subcatData of subcategories) {
      const existingSub = await db
        .collection("subcategories")
        .findOne({ categoryId, slug: subcatData.slug });

      const subcategoryDoc = {
        categoryId,
        name: subcatData.name,
        slug: subcatData.slug,
        description: subcatData.description,
        iconUrl: "🏘️",
        sortOrder: subcatData.sortOrder,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingSub) {
        await db
          .collection("subcategories")
          .updateOne({ _id: existingSub._id }, { $set: subcategoryDoc });
        console.log(`   ✅ Updated: ${subcatData.name}`);
      } else {
        await db.collection("subcategories").insertOne(subcategoryDoc);
        console.log(`   ✅ Created: ${subcatData.name}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ PG/CO-Living category setup complete!");
    console.log("\n📝 Details:");
    console.log(`   Category: PG/CO-Living (pg-co-living)`);
    console.log(`   Subcategories: ${subcategories.length}`);
    subcategories.forEach((sub, idx) => {
      console.log(`   ${idx + 1}. ${sub.name} (${sub.slug})`);
    });
    console.log("\n🌐 Access at: /pg-co-living");
  } catch (error) {
    console.error("❌ Error setting up PG/CO-Living:", error);
    process.exit(1);
  }

  process.exit(0);
}

setupPGCoLiving();
