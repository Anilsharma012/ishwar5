import { RequestHandler } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { ApiResponse } from "@shared/types";

// Multer memory storage for APK uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
export const apkUploadMiddleware = upload.single("apk");

// Get app information
export const getAppInfo: RequestHandler = async (req, res) => {
  try {
    // Check if APK file exists
    const apkPath = path.join(process.cwd(), "public", "app", "AashishProperty.apk");
    const exists = fs.existsSync(apkPath);
    
    let fileInfo = null;
    if (exists) {
      const stats = fs.statSync(apkPath);
      fileInfo = {
        size: stats.size,
        lastModified: stats.mtime,
        version: "1.0.0", // You can read this from package.json or config
      };
    }

    const response: ApiResponse<{
      available: boolean;
      version?: string;
      size?: number;
      lastModified?: Date;
      downloadUrl?: string;
    }> = {
      success: true,
      data: {
        available: exists,
        ...(fileInfo && {
          version: fileInfo.version,
          size: fileInfo.size,
          lastModified: fileInfo.lastModified,
          downloadUrl: "/api/app/download",
        }),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting app info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get app info",
    });
  }
};

// Download APK file
export const downloadAPK: RequestHandler = async (req, res) => {
  try {
    const apkPath = path.join(process.cwd(), "public", "app", "AashishProperty.apk");
    
    // Check if file exists
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({
        success: false,
        error: "APK file not found",
      });
    }

    // Set headers for file download
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", "attachment; filename=AashishProperty.apk");
    res.setHeader("Cache-Control", "no-cache");

    // Stream the file
    const fileStream = fs.createReadStream(apkPath);
    fileStream.pipe(res);

    // Log download
    console.log("APK download initiated:", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date(),
    });

    // Handle stream errors
    fileStream.on("error", (error) => {
      console.error("Error streaming APK file:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Failed to download APK",
        });
      }
    });

  } catch (error) {
    console.error("Error downloading APK:", error);
    res.status(500).json({
      success: false,
      error: "Failed to download APK",
    });
  }
};

// Upload new APK (admin only)
export const uploadAPK: RequestHandler = async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Please send form-data with field name "apk".' });
    }

    const apkDir = path.join(process.cwd(), "public", "app");
    try { if (!fs.existsSync(apkDir)) fs.mkdirSync(apkDir, { recursive: true }); } catch (e) { /* ignore */ }

    const apkPath = path.join(apkDir, "AashishProperty.apk");
    fs.writeFileSync(apkPath, file.buffer);

    const stats = fs.statSync(apkPath);

    const response: ApiResponse<{ message: string; size: number; path: string }> = {
      success: true,
      data: {
        message: "APK uploaded successfully",
        size: stats.size,
        path: "/app/AashishProperty.apk",
      },
    };

    console.log("APK uploaded by admin:", { ip: (req as any).ip, size: stats.size, path: apkPath });

    res.json(response);
  } catch (error) {
    console.error("Error uploading APK:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload APK",
    });
  }
};

// Get download statistics (admin only)
export const getDownloadStats: RequestHandler = async (req, res) => {
  try {
    // This would fetch download statistics from database
    // For now, return mock data
    const response: ApiResponse<{
      totalDownloads: number;
      todayDownloads: number;
      weeklyDownloads: number;
      monthlyDownloads: number;
    }> = {
      success: true,
      data: {
        totalDownloads: 1547,
        todayDownloads: 23,
        weeklyDownloads: 145,
        monthlyDownloads: 632,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting download stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get download stats",
    });
  }
};
