import slugify from "slugify";
import Property from "../../models/Property.js";
import User from "../../models/User.js";
import {cloudinary} from "../../config/cloudinary.config.js";
import redisClient from "../../config/redis.config.js";
import { createNotification } from "../../services/notification.js";

export const checkAgentRole = (user) => {
  if (user.role !== "agent") {
    throw new Error("Only agents can create properties");
  }
};

export const uploadImages = async (files, username) => {
  if (files.length > 30) throw new Error("Maximum 30 images allowed");

  const safeUsername = username.replace(/[^a-zA-Z0-9-_]/g, "_");
  const folderName = `Betahouse/${safeUsername}/properties`;

  const imageUrls = await Promise.all(
    files.map((file) =>
      cloudinary.uploader.upload(file.path, { folder: folderName })
    )
  );

  return imageUrls.map((r) => r.secure_url);
};

export const generateSlug = (title) => {
  return (
    slugify(title, { lower: true, strict: true }) +
    "-" +
    Math.round(Math.random() * 10000)
  );
};

export const invalidateCache = async () => {
  const keys = await redisClient.keys("properties:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

export const notifyAdmins = async (io, onlineUsers, property, user) => {
  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      "property",
      `New property "${property.title}" submitted by ${user.profile.name} (@${user.username}) for approval.`,
      property._id,
      "New Property Submission",
      "Property"
    );
  }
};

export const createPropertyService = async (
  data,
  user,
  files,
  io,
  onlineUsers
) => {
  checkAgentRole(user);

  const imageUrls = await uploadImages(files, user.username);
  const slug = generateSlug(data.title);
  const thumbnail = imageUrls[0] || "";

  const property = new Property({
    ...data,
    slug,
    images: imageUrls,
    thumbnail,
    createdBy: user._id,
  });

  await property.save();
  await invalidateCache();
  await notifyAdmins(io, onlineUsers, property, user);

  return property;
};

export const calculatePreferenceScore = (property, user) => {
  let score = 0;
  const { preferences } = user;

  if (!preferences) return score;

  // Price range match
  if (preferences.priceRange) {
    if (
      property.price >= preferences.priceRange.min &&
      property.price <= preferences.priceRange.max
    ) {
      score += 30;
    }
  }

  // Property type match
  if (
    preferences.propertyType &&
    preferences.propertyType.includes(property.propertyType)
  ) {
    score += 20;
  }

  // Feature match
  if (preferences.features) {
    const matchedFeatures = property.features.filter((f) =>
      preferences.features.includes(f)
    );
    score += matchedFeatures.length * 10;
  }

  // Boost featured properties
  if (property.isFeatured) score += 50;

  // Boost by views and saved count
  score += property.views * 0.1;
  score += property.savedCount * 0.5;

  return score;
};
