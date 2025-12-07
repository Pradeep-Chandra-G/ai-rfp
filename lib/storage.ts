// lib/storage.ts - NEW FILE
import { put, del, list } from "@vercel/blob";

/**
 * Upload a file to Vercel Blob Storage
 * @param filename - The name of the file
 * @param content - File content as Buffer or string
 * @param contentType - MIME type (e.g., 'image/jpeg', 'application/pdf')
 * @param folder - Optional folder prefix (default: 'proposals')
 * @returns Public URL of the uploaded file
 */
export async function uploadToBlob(
  filename: string,
  content: Buffer | string,
  contentType: string,
  folder: string = "proposals"
): Promise<string> {
  try {
    // Generate unique filename to avoid collisions
    const uniqueFilename = `${crypto.randomUUID()}-${filename}`;
    const filePath = `${folder}/${uniqueFilename}`;

    // Ensure content is a Buffer
    const fileBuffer =
      content instanceof Buffer ? content : Buffer.from(content as string, "base64");

    // Upload to Vercel Blob
    const blob = await put(filePath, fileBuffer, {
      access: "public",
      contentType: contentType,
    });

    console.log(`✅ Blob uploaded: ${filename} -> ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error(`❌ Blob upload failed for ${filename}:`, error);
    throw new Error(
      `Failed to upload ${filename}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Delete a file from Vercel Blob Storage
 * @param url - The public URL of the blob to delete
 */
export async function deleteFromBlob(url: string): Promise<void> {
  try {
    await del(url);
    console.log(`🗑️ Blob deleted: ${url}`);
  } catch (error) {
    console.error(`❌ Blob deletion failed for ${url}:`, error);
    throw new Error(
      `Failed to delete blob: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * List all blobs in a folder
 * @param prefix - Folder prefix (e.g., 'proposals/')
 * @returns Array of blob objects
 */
export async function listBlobs(prefix: string = "proposals/") {
  try {
    const { blobs } = await list({ prefix });
    return blobs;
  } catch (error) {
    console.error(`❌ Failed to list blobs with prefix ${prefix}:`, error);
    throw new Error(
      `Failed to list blobs: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Helper to validate if a file type is supported for OCR
 */
export function isSupportedImageType(mimeType: string): boolean {
  const supportedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  return supportedTypes.includes(mimeType.toLowerCase());
}

/**
 * Helper to check if file is a PDF
 */
export function isPDF(mimeType: string): boolean {
  return mimeType.toLowerCase() === "application/pdf";
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
  };

  return mimeMap[mimeType.toLowerCase()] || "bin";
}
