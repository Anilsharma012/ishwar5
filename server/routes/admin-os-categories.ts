import { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { getDatabase } from "../db/mongodb";
import { OsCategory, ApiResponse } from "@shared/types";

// Configure multer for Excel file upload
const uploadDir = "uploads/category-excel";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedMimes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  const allowedExts = [".xlsx", ".xls"];

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files are allowed"));
  }
};

export const excelUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Get all categories
export const getOsCategories: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.active !== undefined) {
      filter.active = req.query.active === "true";
    }

    const [categories, total] = await Promise.all([
      db
        .collection("os_categories")
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("os_categories").countDocuments(filter),
    ]);

    const response: ApiResponse<{
      categories: OsCategory[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }> = {
      success: true,
      data: {
        categories: categories as unknown as OsCategory[],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching OS categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    });
  }
};

// Create category
export const createOsCategory: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const categoryData: Omit<OsCategory, "_id"> = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Check if slug already exists
    const existing = await db
      .collection("os_categories")
      .findOne({ slug: categoryData.slug });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Category with this slug already exists",
      });
    }

    const result = await db.collection("os_categories").insertOne(categoryData);

    // Invalidate cache
    // TODO: Add cache invalidation logic here

    const response: ApiResponse<{ _id: string }> = {
      success: true,
      data: { _id: result.insertedId.toString() },
    };

    res.json(response);
  } catch (error) {
    console.error("Error creating OS category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create category",
    });
  }
};

// Update category
export const updateOsCategory: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const { categoryId } = req.params;

    if (!ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID",
      });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    // If slug is being updated, check if it already exists
    if (updateData.slug) {
      const existing = await db.collection("os_categories").findOne({
        slug: updateData.slug,
        _id: { $ne: new ObjectId(categoryId) },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          error: "Category with this slug already exists",
        });
      }
    }

    const result = await db
      .collection("os_categories")
      .updateOne({ _id: new ObjectId(categoryId) }, { $set: updateData });

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Invalidate cache
    // TODO: Add cache invalidation logic here

    const response: ApiResponse<{ updated: boolean }> = {
      success: true,
      data: { updated: true },
    };

    res.json(response);
  } catch (error) {
    console.error("Error updating OS category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update category",
    });
  }
};

// Delete category
export const deleteOsCategory: RequestHandler = async (req, res) => {
  try {
    const db = getDatabase();
    const { categoryId } = req.params;

    if (!ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid category ID",
      });
    }

    // Check if category has subcategories
    const subcategoryCount = await db
      .collection("os_subcategories")
      .countDocuments({ category: categoryId });

    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete category with existing subcategories",
      });
    }

    const result = await db
      .collection("os_categories")
      .deleteOne({ _id: new ObjectId(categoryId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Invalidate cache
    // TODO: Add cache invalidation logic here

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    res.json(response);
  } catch (error) {
    console.error("Error deleting OS category:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete category",
    });
  }
};

// Upload Excel file for category or subcategory
export const uploadExcelFile: RequestHandler = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const { categoryId, subcategoryId } = req.body;

    if (!categoryId && !subcategoryId) {
      return res.status(400).json({
        success: false,
        error: "Either categoryId or subcategoryId is required",
      });
    }

    const db = getDatabase();
    const fileUrl = `/uploads/category-excel/${path.basename(req.file.path)}`;
    const fileData = {
      fileName: req.file.originalname,
      fileUrl,
      uploadedAt: new Date(),
    };

    if (subcategoryId) {
      if (!ObjectId.isValid(subcategoryId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid subcategory ID",
        });
      }

      const result = await db
        .collection("os_subcategories")
        .updateOne(
          { _id: new ObjectId(subcategoryId) },
          { $set: { excelFile: fileData, updatedAt: new Date() } },
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Subcategory not found",
        });
      }
    } else if (categoryId) {
      if (!ObjectId.isValid(categoryId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }

      const result = await db
        .collection("os_categories")
        .updateOne(
          { _id: new ObjectId(categoryId) },
          { $set: { excelFile: fileData, updatedAt: new Date() } },
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }
    }

    const response: ApiResponse<{ excelFile: typeof fileData }> = {
      success: true,
      data: { excelFile: fileData },
    };

    res.json(response);
  } catch (error) {
    console.error("Error uploading Excel file:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload Excel file",
    });
  }
};
