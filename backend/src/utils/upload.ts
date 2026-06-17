import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";
import { logger } from "./logger";

// Configure Cloudinary
if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  logger.warn("⚠️  Cloudinary not configured — file uploads will be disabled");
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export async function uploadImage(
  fileBuffer: Buffer,
  folder: string,
  publicId?: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `school-mgmt/${folder}`,
        public_id: publicId,
        resource_type: "image",
        transformation: [
          { quality: "auto", fetch_format: "auto" },
          { width: 800, height: 800, crop: "limit" },
        ],
      },
      (error, result) => {
        if (error || !result) { reject(error || new Error("Upload failed")); return; }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export async function uploadAvatar(fileBuffer: Buffer, userId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "school-mgmt/avatars",
        public_id: `avatar_${userId}`,
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 200, height: 200, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) { reject(error || new Error("Upload failed")); return; }
        resolve({ url: result.secure_url, publicId: result.public_id, format: result.format, bytes: result.bytes });
      }
    );
    stream.end(fileBuffer);
  });
}

export async function uploadDocument(
  fileBuffer: Buffer,
  folder: string,
  filename: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `school-mgmt/${folder}`,
        public_id: filename,
        resource_type: "raw",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) { reject(error || new Error("Upload failed")); return; }
        resolve({ url: result.secure_url, publicId: result.public_id, format: result.format, bytes: result.bytes });
      }
    );
    stream.end(fileBuffer);
  });
}

export async function deleteFile(publicId: string, resourceType: "image" | "raw" = "image"): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    logger.error("Failed to delete Cloudinary file:", err);
  }
}

// ─── Multer integration ───────────────────────────────────────────────────────

import multer from "multer";

// Store in memory for Cloudinary upload (max 10 MB)
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB for avatars
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Avatar must be a JPG, PNG, or WebP image"));
    }
  },
});
