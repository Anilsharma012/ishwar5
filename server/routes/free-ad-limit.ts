import { Router, RequestHandler } from "express";
import { connectToDatabase } from "../db/mongodb";

const router = Router();

interface FreeAdSettings {
  maxFreeAdsPerMonth: number;
  numberOfDays: number;
  isActive: boolean;
}

interface UserAdPost {
  userId: string;
  propertyId: string;
  postedAt: Date;
  isPaid: boolean;
}

const DEFAULT_SETTINGS: FreeAdSettings = {
  maxFreeAdsPerMonth: 2,
  numberOfDays: 30,
  isActive: true,
};

export const getSettings: RequestHandler = async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("free_ad_settings");

    let settings = await collection.findOne({ _id: "default" });

    if (!settings) {
      await collection.insertOne({ _id: "default", ...DEFAULT_SETTINGS });
      settings = { _id: "default", ...DEFAULT_SETTINGS };
    }

    res.json({
      success: true,
      data: {
        maxFreeAdsPerMonth: settings.maxFreeAdsPerMonth,
        numberOfDays: settings.numberOfDays,
        isActive: settings.isActive,
      },
    });
  } catch (error) {
    console.error("Error fetching free ad settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings",
    });
  }
};

export const updateSettings: RequestHandler = async (req, res) => {
  try {
    const { maxFreeAdsPerMonth, numberOfDays, isActive } = req.body;

    if (
      typeof maxFreeAdsPerMonth !== "number" ||
      typeof numberOfDays !== "number"
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid settings values",
      });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection("free_ad_settings");

    await collection.updateOne(
      { _id: "default" },
      {
        $set: {
          maxFreeAdsPerMonth,
          numberOfDays,
          isActive,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    res.json({
      success: true,
      data: {
        maxFreeAdsPerMonth,
        numberOfDays,
        isActive,
      },
    });
  } catch (error) {
    console.error("Error updating free ad settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update settings",
    });
  }
};

export const checkUserFreeAdLimit: RequestHandler = async (req, res) => {
  try {
    const userId = String((req as any).userId);

    const { db } = await connectToDatabase();

    // Get settings
    const settingsCollection = db.collection("free_ad_settings");
    let settings = await settingsCollection.findOne({ _id: "default" });
    if (!settings) {
      settings = { ...DEFAULT_SETTINGS };
    }

    if (!settings.isActive) {
      return res.json({
        success: true,
        data: {
          canPostFree: true,
          remaining: Infinity,
          limit: Infinity,
          periodDays: settings.numberOfDays,
          systemActive: false,
        },
      });
    }

    // Calculate date X days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - settings.numberOfDays);

    // Count free posts in the period
    const propertiesCollection = db.collection("properties");
    const freePostsCount = await propertiesCollection.countDocuments({
      ownerId: userId,
      createdAt: { $gte: startDate },
      isPaid: { $ne: true },
      packageId: { $exists: false },
    });

    const remaining = Math.max(0, settings.maxFreeAdsPerMonth - freePostsCount);
    const canPostFree = remaining > 0;

    res.json({
      success: true,
      data: {
        canPostFree,
        remaining,
        limit: settings.maxFreeAdsPerMonth,
        used: freePostsCount,
        periodDays: settings.numberOfDays,
        nextResetDate: new Date(
          startDate.getTime() + settings.numberOfDays * 24 * 60 * 60 * 1000,
        ),
        systemActive: true,
      },
    });
  } catch (error) {
    console.error("Error checking free ad limit:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check free ad limit",
    });
  }
};

export const recordFreeAdPost: RequestHandler = async (req, res) => {
  try {
    const userId = String((req as any).userId);
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: "Property ID is required",
      });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection("free_ad_posts");

    await collection.insertOne({
      userId,
      propertyId,
      postedAt: new Date(),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      data: { message: "Free ad post recorded" },
    });
  } catch (error) {
    console.error("Error recording free ad post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record free ad post",
    });
  }
};

export default router;
