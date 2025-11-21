// server/scripts/initializeAdvertisementBanners.ts
import { getDatabase } from "../db/mongodb";

const initializeAdvertisementBanners = async () => {
  try {
    const db = getDatabase();
    const bannerCollection = db.collection("banners");

    // Check if advertisement banners already exist
    const existingCount = await bannerCollection.countDocuments({
      position: "advertisement_banners",
    });

    if (existingCount >= 4) {
      console.log(
        "✅ Advertisement banners already exist. Skipping initialization.",
      );
      return;
    }

    // Default advertisement banners
    const advertisementBanners = [
      {
        title: "Advertise Your New Residential Project in Rohtak",
        description:
          "Reach thousands of homebuyers looking for their dream home",
        imageUrl:
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600&auto=format&fit=crop",
        link: "",
        position: "advertisement_banners",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: "Advertise Your New Commercial Project in Rohtak",
        description: "Connect with business owners and investors",
        imageUrl:
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1600&auto=format&fit=crop",
        link: "",
        position: "advertisement_banners",
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: "Advertise Your Real Estate Investment Project in Rohtak",
        description: "Attract serious investors to your projects",
        imageUrl:
          "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=1600&auto=format&fit=crop",
        link: "",
        position: "advertisement_banners",
        isActive: true,
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: "Advertise Your Industrial Property in Rohtak",
        description: "Find the right businesses and manufacturers",
        imageUrl:
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop",
        link: "",
        position: "advertisement_banners",
        isActive: true,
        sortOrder: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Delete existing advertisement banners first
    await bannerCollection.deleteMany({ position: "advertisement_banners" });

    // Insert new ones
    const result = await bannerCollection.insertMany(
      advertisementBanners as any,
    );

    console.log(
      `✅ Successfully initialized ${result.insertedIds ? Object.keys(result.insertedIds).length : 4} advertisement banners`,
    );
    console.log("Advertisement banners are ready!");
  } catch (error) {
    console.error("❌ Error initializing advertisement banners:", error);
    throw error;
  }
};

export default initializeAdvertisementBanners;
