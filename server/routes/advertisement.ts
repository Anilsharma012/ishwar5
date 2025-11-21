// server/routes/advertisement.ts
import { RequestHandler } from "express";
import { getDatabase } from "../db/mongodb";
import { ObjectId } from "mongodb";

export interface AdvertisementSubmission {
  _id?: string;
  bannerType: string;
  fullName: string;
  email: string;
  phone: string;
  projectName: string;
  location: string;
  projectType: string;
  budget?: string;
  description: string;
  status: "new" | "viewed" | "contacted";
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Create advertisement submission
export const createAdvertisementSubmission: RequestHandler = async (
  req,
  res,
) => {
  try {
    const db = getDatabase();
    const submissionData = req.body;

    // Validate required fields
    if (
      !submissionData.fullName ||
      !submissionData.email ||
      !submissionData.phone ||
      !submissionData.projectName ||
      !submissionData.location ||
      !submissionData.description ||
      !submissionData.bannerType
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(submissionData.email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[0-9\s\-\+\(\)]{10,}$/;
    if (!phoneRegex.test(submissionData.phone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone format",
      });
    }

    const newSubmission: AdvertisementSubmission = {
      ...submissionData,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .collection("advertisement_submissions")
      .insertOne(newSubmission as any);

    const response: ApiResponse<{
      _id: string;
      submission: AdvertisementSubmission;
    }> = {
      success: true,
      data: {
        _id: result.insertedId.toString(),
        submission: {
          ...newSubmission,
          _id: result.insertedId.toString(),
        },
      },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating advertisement submission:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create submission",
    });
  }
};

// Get all advertisement submissions (admin only)
export const getAdvertisementSubmissions: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const {
      page = 1,
      limit = 20,
      status,
      bannerType,
      search,
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      bannerType?: string;
      search?: string;
    };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (bannerType) {
      filter.bannerType = bannerType;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { projectName: { $regex: search, $options: "i" } },
      ];
    }

    const total = await db
      .collection("advertisement_submissions")
      .countDocuments(filter);

    const submissions = await db
      .collection("advertisement_submissions")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const response: ApiResponse<{
      submissions: AdvertisementSubmission[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }> = {
      success: true,
      data: {
        submissions: submissions as AdvertisementSubmission[],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching advertisement submissions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch submissions",
    });
  }
};

// Get single submission
export const getAdvertisementSubmission: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid submission ID",
      });
    }

    const submission = await db
      .collection("advertisement_submissions")
      .findOne({ _id: new ObjectId(id) });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: "Submission not found",
      });
    }

    // Update status to viewed if it was new
    if (submission.status === "new") {
      await db
        .collection("advertisement_submissions")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "viewed", updatedAt: new Date() } },
        );
      submission.status = "viewed";
      submission.updatedAt = new Date();
    }

    const response: ApiResponse<AdvertisementSubmission> = {
      success: true,
      data: submission as AdvertisementSubmission,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching advertisement submission:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch submission",
    });
  }
};

// Update submission status
export const updateAdvertisementSubmissionStatus: RequestHandler = async (
  req,
  res,
) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid submission ID",
      });
    }

    if (!["new", "viewed", "contacted"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    const result = await db
      .collection("advertisement_submissions")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, updatedAt: new Date() } },
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Submission not found",
      });
    }

    const submission = await db
      .collection("advertisement_submissions")
      .findOne({ _id: new ObjectId(id) });

    const response: ApiResponse<AdvertisementSubmission> = {
      success: true,
      data: submission as AdvertisementSubmission,
    };

    res.json(response);
  } catch (error) {
    console.error("Error updating advertisement submission:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update submission",
    });
  }
};

// Delete submission
export const deleteAdvertisementSubmission: RequestHandler = async (
  req,
  res,
) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid submission ID",
      });
    }

    const result = await db
      .collection("advertisement_submissions")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Submission not found",
      });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Submission deleted successfully" },
    };

    res.json(response);
  } catch (error) {
    console.error("Error deleting advertisement submission:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete submission",
    });
  }
};

// Get statistics
export const getAdvertisementStatistics: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();

    const total = await db
      .collection("advertisement_submissions")
      .countDocuments();

    const newCount = await db
      .collection("advertisement_submissions")
      .countDocuments({ status: "new" });

    const viewedCount = await db
      .collection("advertisement_submissions")
      .countDocuments({ status: "viewed" });

    const contactedCount = await db
      .collection("advertisement_submissions")
      .countDocuments({ status: "contacted" });

    const byBannerType = await db
      .collection("advertisement_submissions")
      .aggregate([
        {
          $group: {
            _id: "$bannerType",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const response: ApiResponse<{
      total: number;
      new: number;
      viewed: number;
      contacted: number;
      byBannerType: Array<{ _id: string; count: number }>;
    }> = {
      success: true,
      data: {
        total,
        new: newCount,
        viewed: viewedCount,
        contacted: contactedCount,
        byBannerType: byBannerType as any,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching advertisement statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
};
