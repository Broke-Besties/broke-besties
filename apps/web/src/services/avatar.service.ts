import { createAdminClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

const BUCKET_NAME = "avatars";
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export class AvatarService {
  /**
   * Upload an avatar for a user
   */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(
        "Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.",
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File size too large. Maximum size is 20MB.");
    }

    const supabase = createAdminClient();

    // Get file extension from mime type
    const ext = file.type.split("/")[1];
    const filePath = `${userId}/avatar.${ext}`;

    // Delete existing avatar files for this user (any extension)
    await this.deleteExistingAvatars(userId);

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload the new avatar
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError.message, uploadError);
      throw new Error(`Failed to upload avatar: ${uploadError.message}`);
    }

    // Store the file path (not URL) in the database
    await prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl: filePath },
    });

    // Return a signed URL for immediate use
    const signedUrl = await this.getSignedUrl(filePath);
    if (!signedUrl) {
      throw new Error("Failed to generate signed URL for avatar");
    }

    return signedUrl;
  }

  /**
   * Get a signed URL for an avatar file path
   */
  async getSignedUrl(filePath: string): Promise<string | null> {
    if (!filePath) return null;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  }

  /**
   * Delete existing avatar files for a user
   */
  private async deleteExistingAvatars(userId: string): Promise<void> {
    const supabase = createAdminClient();

    // List all files in the user's avatar folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId);

    if (listError) {
      console.error("Error listing avatars:", listError);
      return;
    }

    if (files && files.length > 0) {
      const filePaths = files.map((file) => `${userId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        console.error("Error deleting existing avatars:", deleteError);
      }
    }
  }

  /**
   * Delete a user's avatar
   */
  async deleteAvatar(userId: string): Promise<void> {
    await this.deleteExistingAvatars(userId);

    // Clear the profilePictureUrl in the database
    await prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl: null },
    });
  }
}

export const avatarService = new AvatarService();
