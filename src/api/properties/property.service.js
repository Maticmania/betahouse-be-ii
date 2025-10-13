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

export const updatePropertyService = async (propertyId, userId, userRole, updateData, files) => {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new Error("Property not found");
  }

  if (property.createdBy.toString() !== userId.toString() && userRole !== "admin") {
    throw new Error("Not authorized to update this property");
  }

  const {
    title,
    description,
    price,
    priceType,
    forSale,
    location,
    propertyType,
    features,
    details,
    parking,
    lot,
    construction,
    virtualSchema,
  } = updateData;

  if (files && files.length > 0) {
    if (property.images.length + files.length > 30) {
      throw new Error("Maximum 30 images allowed");
    }
    const newImageUrls = await uploadImages(files, userId);
    property.images = [...property.images, ...newImageUrls];
    if (!property.thumbnail) {
      property.thumbnail = newImageUrls[0] || "";
    }
  }

  property.title = title || property.title;
  property.description = description || property.description;
  property.price = price || property.price;
  property.priceType = priceType || property.priceType;
  property.forSale = forSale !== undefined ? forSale : property.forSale;
  property.location = location || property.location;
  property.propertyType = propertyType || property.propertyType;
  property.features = features || property.features;
  property.details = details || property.details;
  property.parking = parking || property.parking;
  property.lot = lot || property.lot;
  property.construction = construction || property.construction;
  property.virtualSchema = virtualSchema
    ? JSON.parse(virtualSchema)
    : property.virtualSchema;

  await property.save();
  await invalidateCache();

  return property;
};

export const deletePropertyService = async (propertyId, userId, userRole) => {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new Error("Property not found");
  }

  if (property.createdBy.toString() !== userId.toString() && userRole !== "admin") {
    throw new Error("Not authorized to delete this property");
  }

  // Delete images from Cloudinary
  for (const imageUrl of [...property.images, property.thumbnail]) {
    if (imageUrl) {
      const publicId = imageUrl.split("/").pop().split(".")[0];
      const safeUsername = property.createdBy.toString().replace(/[^a-zA-Z0-9-_]/g, "_");
      await cloudinary.uploader.destroy(
        `Betahouse/${safeUsername}/properties/${publicId}`
      );
    }
  }

  await property.deleteOne();
  await invalidateCache();
};

export const listPropertiesService = async (query, user) => {
  const {
    page = 1,
    limit = 30,
    search,
    state,
    lga,
    location,
    propertyType,
    forSale,
    bedrooms,
    bathrooms,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    yearBuiltMin,
    yearBuiltMax,
    hasParking,
    hasFireplace,
    isFeatured,
    features,
    sortBy = "score",
    sortOrder = "asc",
  } = query;

  const cacheKey = `properties:${JSON.stringify(query)}`;
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  const queryFilter = { status: "available" };
  const orConditions = [];

  if (propertyType && propertyType !== "all") queryFilter.propertyType = propertyType;
  if (state) queryFilter["address.state"] = state;
  if (lga) queryFilter.lga = lga;
  if (forSale !== undefined) queryFilter.forSale = forSale === "true";

  if (bedrooms) queryFilter["details.bedrooms"] = { $gte: Number(bedrooms) };
  if (bathrooms) queryFilter["details.bathrooms"] = { $gte: Number(bathrooms) };

  if (minPrice || maxPrice) {
    queryFilter.price = {};
    if (minPrice) queryFilter.price.$gte = Number(minPrice);
    if (maxPrice) queryFilter.price.$lte = Number(maxPrice);
  }

  if (minArea || maxArea) {
    queryFilter["details.area.totalStructure"] = {};
    if (minArea) queryFilter["details.area.totalStructure"].$gte = Number(minArea);
    if (maxArea) queryFilter["details.area.totalStructure"].$lte = Number(maxArea);
  }

  if (yearBuiltMin || yearBuiltMax) {
    queryFilter["construction.yearBuilt"] = {};
    if (yearBuiltMin) queryFilter["construction.yearBuilt"].$gte = Number(yearBuiltMin);
    if (yearBuiltMax) queryFilter["construction.yearBuilt"].$lte = Number(yearBuiltMax);
  }

  if (hasParking !== undefined) {
    queryFilter["parking.totalSpaces"] = hasParking === "true" ? { $gt: 0 } : 0;
  }

  if (hasFireplace !== undefined) queryFilter["details.fireplace"] = hasFireplace === "true";
  if (isFeatured !== undefined) queryFilter.isFeatured = isFeatured === "true";

  if (features) {
    const featuresArray = Array.isArray(features)
      ? features
      : features.split(",").map(f => f.trim());
    if (featuresArray.length > 0) {
      queryFilter.features = { $all: featuresArray };
    }
  }

  if (search) {
    orConditions.push(
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    );
  }

  if (location) {
    const regex = new RegExp(location, "i");
    orConditions.push(
      { "address.state": regex },
      { "address.city": regex },
      { "address.street": regex },
      { "address.area": regex },
      { lga: regex },
      { town: regex }
    );
  }

  if (orConditions.length > 0) {
    queryFilter.$or = orConditions; 
  }

  const sortDir = sortOrder === "asc" ? 1 : -1;
  let properties;
  let total;

  const userDoc = user ? await User.findById(user._id).lean() : null;

  if (sortBy === "score" && userDoc) {
    let all = await Property.find(queryFilter)
      .populate("createdBy", "profile.name")
      .limit(200)
      .lean();

    all = all.map((p) => ({
      ...p,
      score: calculatePreferenceScore(p, userDoc),
    }));

    all.sort((a, b) => sortDir * (b.score - a.score));

    properties = all.slice((page - 1) * limit, (page - 1) * limit + Number(limit));
    total = all.length;
  } else {
    properties = await Property.find(queryFilter)
      .populate("createdBy", "profile.name")
      .sort({ [sortBy]: sortDir })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    total = await Property.countDocuments(queryFilter);
  }

  const response = {
    properties,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };

  await redisClient.set(cacheKey, JSON.stringify(response), "EX", 600);

  return response;
};

export const listMyPropertiesService = async (userId, role, query) => {
  const { page = 1, limit = 10, status } = query;

  const queryFilter = {};
  if (role === "agent") {
    queryFilter.createdBy = userId;
  }
  if (status) {
    queryFilter.status = status;
  }

  const properties = await Property.find(queryFilter)
    .populate("createdBy", "profile.name username")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await Property.countDocuments(queryFilter);

  return {
    properties,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

export const getPropertyService = async (propertyId, user, ip) => {
  const property = await Property.findById(propertyId).populate(
    "createdBy",
    "profile"
  );

  if (
    !property ||
    (property.status === "pending" &&
      user?.role !== "admin" &&
      property.createdBy._id.toString() !== user?._id.toString())
  ) {
    return null;
  }

  if (
    user?.role !== "admin" &&
    property.createdBy._id.toString() !== user?._id.toString()
  ) {
    const redisKey = `property:${propertyId}:views:${ip}`;
    const hasViewed = await redisClient.exists(redisKey);

    if (!hasViewed) {
      property.views += 1;
      await property.save();
      await redisClient.set(redisKey, "1", "EX", 86400);
    }
  }

  return property;
};

export const toggleWishlistService = async (userId, propertyId) => {
  const user = await User.findById(userId);
  const property = await Property.findById(propertyId);

  if (!property || property.status !== "available") {
    throw new Error("Property not found or not available");
  }

  const index = user.wishlist.indexOf(propertyId);
  if (index === -1) {
    user.wishlist.push(propertyId);
    property.savedCount += 1;
  } else {
    user.wishlist.splice(index, 1);
    property.savedCount = Math.max(0, property.savedCount - 1);
  }

  await user.save();
  await property.save();

  return user.wishlist;
};

export const getMyWishlistService = async (userId) => {
  const user = await User.findById(userId).populate({
    path: "wishlist",
    match: { status: "available" },
    populate: { path: "createdBy", select: "profile.name username" },
  });

  return user.wishlist || [];
};

export const updatePropertyStatusService = async (propertyId, status, io, onlineUsers) => {
  if (!["available", "rejected"].includes(status)) {
    throw new Error("Invalid status");
  }

  const property = await Property.findById(propertyId);
  if (!property) {
    throw new Error("Property not found");
  }

  property.status = status;
  await property.save();

  const agent = await User.findById(property.createdBy);
  await createNotification(
    io,
    onlineUsers,
    agent._id,
    "property",
    `Your property "${property.title}" has been ${status}.`,
    property._id,
    `Property ${status === "available" ? "Approved" : "Rejected"}`,
    "Property"
  );

  return property;
};

export const toggleFeaturedService = async (propertyId, io, onlineUsers) => {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new Error("Property not found");
  }

  property.isFeatured = !property.isFeatured;
  await property.save();

  const agent = await User.findById(property.createdBy);
  await createNotification(
    io,
    onlineUsers,
    agent._id,
    "property",
    `Your property "${property.title}" has been ${
      property.isFeatured ? "featured" : "unfeatured"
    }.`,
    property._id,
    property.isFeatured ? "Property Featured" : "Property Unfeatured",
    "Property"
  );

  return property;
};

export const searchPropertiesService = async (query) => {
  const { keyword, state, lga, minPrice, maxPrice, propertyType, location } =
    query;
  const cacheKey = `property:search:${keyword || "_"}:${state || "_"}:${
    lga || "_"
  }:${location || "_"}:${minPrice || 0}:${maxPrice || "_"}:${
    propertyType || "_"
  }`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const queryFilter = { status: "available" };
  if (state) queryFilter["location.state"] = state;
  if (lga) queryFilter["location.lga"] = lga;
  if (propertyType) queryFilter.propertyType = propertyType;
  if (minPrice || maxPrice) queryFilter.price = {};
  if (minPrice) queryFilter.price.$gte = Number(minPrice);
  if (maxPrice) queryFilter.price.$lte = Number(maxPrice);
  if (keyword) queryFilter.$text = { $search: keyword };

  const properties = await Property.find(queryFilter).lean();

  await redisClient.set(cacheKey, JSON.stringify({ properties }), "EX", 600);

  return properties;
};

export const getGeneralPropertyStatsService = async () => {
  const stats = await redisClient.get("property:stats:general");
  if (stats) return JSON.parse(stats);

  const total = await Property.countDocuments();
  const available = await Property.countDocuments({ status: "available" });
  const sold = await Property.countDocuments({ status: "sold" });

  const result = { total, available, sold };
  await redisClient.setEx(
    "property:stats:general",
    3600,
    JSON.stringify(result)
  );

  return result;
};

export const getAgentPropertyStatsService = async (agentId) => {
  const cacheKey = `property:stats:agent:${agentId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const total = await Property.countDocuments({ createdBy: agentId });
  const available = await Property.countDocuments({
    createdBy: agentId,
    status: "available",
  });
  const sold = await Property.countDocuments({
    createdBy: agentId,
    status: "sold",
  });
  const result = { total, available, sold };

  await redisClient.setEx(cacheKey, 1800, JSON.stringify(result));
  return result;
};

export const deletePropertyImageService = async (propertyId, imageId) => {
  const property = await Property.findById(propertyId);
  if (!property) throw new Error("Property not found");

  property.images = property.images.filter((img) => !img.includes(imageId));
  if (property.thumbnail.includes(imageId)) property.thumbnail = "";

  await property.save();
  await redisClient.del(`property:${propertyId}`);

  return property.images;
};
