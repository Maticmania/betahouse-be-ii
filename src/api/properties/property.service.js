import slugify from "slugify";
import Property from "../../models/Property.js";
import Agent from "../../models/Agent.js";
import User from "../../models/User.js";
import redisClient from "../../config/redis.config.js";
import { createNotification } from "../../services/notification.js";
import { setCache } from "../../utils/cache.js";

const generatePropertyId = () => {
  return `BH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

const generateSlug = (title, propertyId) => {
  if (!title || typeof title !== "string") {
    throw new Error("Invalid title provided for slug generation");
  }
  if (!propertyId) {
    throw new Error("Property ID missing for slug generation");
  }

  const baseSlug = slugify(title, { lower: true, strict: true });
  return `${baseSlug}-${propertyId.toLowerCase()}`;
};

const invalidateCache = async () => {
  const keys = await redisClient.keys("properties*");
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

export const calculatePreferenceScore = (property, user) => {
  let score = 0;
  const { preferences } = user;

  if (!preferences) return score;

  if (preferences.priceRange) {
    if (
      property.price >= preferences.priceRange.min &&
      property.price <= preferences.priceRange.max
    ) {
      score += 30;
    }
  }

  if (
    preferences.propertyType &&
    preferences.propertyType.includes(property.propertyType)
  ) {
    score += 20;
  }

  if (preferences.features) {
    const matchedFeatures = property.features.filter((f) =>
      preferences.features.includes(f)
    );
    score += matchedFeatures.length * 10;
  }

  if (property.isFeatured) score += 50;

  score += property.views * 0.1;
  score += property.savedCount * 0.5;

  return score;
};

export const saveAsDraftService = async (data, agent) => {
  const propertyId = generatePropertyId();
  const slug = generateSlug(data.title, propertyId);

  const property = new Property({
    ...data,
    propertyId,
    slug,
    agent: agent._id,
    status: "draft",
  });

  await property.save();

  return property;
};

export const createPropertyService = async (data, agent, io, onlineUsers) => {
  const propertyId = generatePropertyId();
  const slug = generateSlug(data.title, propertyId);

  const property = new Property({
    ...data,
    propertyId,
    slug,
    agent: agent._id,
    status: "pending",
    savedCount: 0,
    views: 0,
    isFeatured: false,
  });

  await property.save();

  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      "property",
      `New property "${property.title}" submitted by ${agent.agentId} for approval.`,
      property.propertyId,
      "New Property Submission",
      "Property"
    );
  }

  return property;
};

export const publishPropertyService = async (
  propertyId,
  agentId,
  io,
  onlineUsers
) => {
  const property = await Property.findOne({ propertyId });

  if (!property) {
    throw new Error("Property not found");
  }

  if (property.agent.toString() !== agentId.toString()) {
    throw new Error("Not authorized to publish this property");
  }

  if (property.status !== "draft") {
    throw new Error("Property is not a draft");
  }

  property.status = "pending";
  await property.save();

  // Notify admins
  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      "property",
      `Property "${property.title}" has been published and is pending approval.`,
      property.propertyId,
      "Property Published",
      "Property"
    );
  }

  return property;
};

export const updatePropertyService = async (
  propertyId,
  agentId,
  userRole,
  updateData
) => {
  const property = await Property.findOne({ propertyId });

  if (!property) {
    throw new Error("Property not found");
  }

  if (
    property.agent.toString() !== agentId.toString() &&
    userRole !== "admin"
  ) {
    throw new Error("Not authorized to update this property");
  }

  if (!updateData || typeof updateData !== "object") {
    throw new Error("Invalid update data");
  }

  const forbiddenFields = [
    "propertyId",
    "slug",
    "agent",
    "views",
    "savedCount",
    "isFeatured",
    "status",
  ];

  Object.keys(updateData).forEach((key) => {
    if (!forbiddenFields.includes(key)) {
      property[key] = updateData[key];
    }
  });

  if (updateData.title) {
    property.slug = generateSlug(updateData.title, property.propertyId);
  }

  await property.save();
  await invalidateCache();

  return property;
};

export const deletePropertyService = async (propertyId, agentId, userRole) => {
  const property = await Property.findOne({ propertyId });

  if (!property) {
    throw new Error("Property not found");
  }

  if (
    property.agent.toString() !== agentId.toString() &&
    userRole !== "admin"
  ) {
    throw new Error("Not authorized to delete this property");
  }

  const agent = await Agent.findById(agentId).populate("user");

  for (const image of [...property.images, property.thumbnail]) {
    if (image && image.publicId) {
      await cloudinary.uploader.destroy(
        `Betahouse/${agent.user}/${image.publicId}`
      );
    }
  }

  await property.deleteOne();
  await invalidateCache();
};

export const getMyDraftsService = async (agentId) => {
  const properties = await Property.find({
    agent: agentId,
    status: "draft",
  }).sort({ createdAt: -1 });
  return properties;
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
  const queryFilter = { status: { $in: ["available", "rented", "sold"] } };
  const orConditions = [];

  if (propertyType && propertyType !== "all")
    queryFilter.propertyType = propertyType;
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
    if (minArea)
      queryFilter["details.area.totalStructure"].$gte = Number(minArea);
    if (maxArea)
      queryFilter["details.area.totalStructure"].$lte = Number(maxArea);
  }

  if (yearBuiltMin || yearBuiltMax) {
    queryFilter["construction.yearBuilt"] = {};
    if (yearBuiltMin)
      queryFilter["construction.yearBuilt"].$gte = Number(yearBuiltMin);
    if (yearBuiltMax)
      queryFilter["construction.yearBuilt"].$lte = Number(yearBuiltMax);
  }

  if (hasParking !== undefined) {
    queryFilter["parking.totalSpaces"] = hasParking === "true" ? { $gt: 0 } : 0;
  }

  if (hasFireplace !== undefined)
    queryFilter["details.fireplace"] = hasFireplace === "true";
  if (isFeatured !== undefined) queryFilter.isFeatured = isFeatured === "true";

  if (features) {
    const featuresArray = Array.isArray(features)
      ? features
      : features.split(",").map((f) => f.trim());
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
      .populate({
        path: "createdBy",
        populate: { path: "user", select: "profile.name" },
      })
      .limit(200)
      .lean();

    all = all.map((p) => ({
      ...p,
      score: calculatePreferenceScore(p, userDoc),
    }));

    all.sort((a, b) => sortDir * (b.score - a.score));

    properties = all.slice(
      (page - 1) * limit,
      (page - 1) * limit + Number(limit)
    );
    total = all.length;
  } else {
    properties = await Property.find(queryFilter)
      .populate({
        path: "createdBy",
        populate: { path: "user", select: "profile.name" },
      })
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

export const listMyPropertiesService = async (agentId, role, query) => {
  const { page = 1, limit = 10, status } = query;

  const queryFilter = {};
  if (role === "agent") {
    queryFilter.agent = agentId;
  }
  if (status) {
    queryFilter.status = status;
  }

  const properties = await Property.find(queryFilter)
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

export const getPropertyBySlugService = async (slug, ip) => {
  const cacheKey = `property:${slug}:public`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const property = await Property.findOne({ slug }).populate({
    path: "agent",
    select: "agentId personal user",
    populate: { path: "user", select: "_id profile.name" },
  });

  if (!property) return null;

  const isPublic = ["available", "rented", "sold"].includes(property.status);
  if (!isPublic) return null;

  const viewKey = `property:${property.propertyId}:views:${ip}`;
  const hasViewed = await redisClient.exists(viewKey);

  if (!hasViewed) {
    await Property.updateOne(
      { propertyId: property.propertyId },
      { $inc: { views: 1 } }
    );
    await redisClient.set(viewKey, "1", "EX", 86400);
  }

  // Cache the property
  await setCache(cacheKey, JSON.stringify(property), 600);

  return property;
};


export const getPropertyService = async (propertyId, user, ip) => {
  const property = await Property.findOne({ propertyId }).populate({
    path: "agent",
    select: "agentId personal user",
    populate: {
      path: "user",
      select: "_id profile.name",
    },
  });

  if (!property) return null;

  const isAdmin = user?.role === "admin";
  const isOwner =
    user && property.agent?.user?._id?.toString() === user._id?.toString();
  const isPublic = ["available", "rented", "sold"].includes(property.status);

  //  Allow access if admin, owner, or public
  if (isAdmin || isOwner || isPublic) {
    // Increment views only for public visitors
    if (isPublic) {
      const redisKey = `property:${propertyId}:views:${ip}`;
      const hasViewed = await redisClient.exists(redisKey);

      if (!hasViewed) {
        await Property.updateOne({ propertyId }, { $inc: { views: 1 } });
        await redisClient.set(redisKey, "1", "EX", 86400); // cache 24h
      }
    }

    return property;
  }

  // Otherwise, restrict access
  return null;
};

export const toggleWishlistService = async (userId, propertyId) => {
  const user = await User.findById(userId);
  const property = await Property.findOne({ propertyId });

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
    populate: {
      path: "createdBy",
      populate: { path: "user", select: "profile.name username" },
    },
  });

  return user.wishlist || [];
};

export const updatePropertyStatusService = async (
  propertyId,
  status,
  io,
  onlineUsers
) => {
  if (!["available", "rejected"].includes(status)) {
    throw new Error("Invalid status");
  }

  const property = await Property.findOne({ propertyId });
  if (!property) {
    throw new Error("Property not found");
  }

  property.status = status;
  await property.save();

  const agent = await Agent.findById(property.createdBy);
  await createNotification(
    io,
    onlineUsers,
    agent.user,
    "property",
    `Your property "${property.title}" has been ${status}.`,
    property._id,
    `Property ${status === "available" ? "Approved" : "Rejected"}`,
    "Property"
  );

  return property;
};

export const toggleFeaturedService = async (propertyId, io, onlineUsers) => {
  const property = await Property.findOne({ propertyId });

  if (!property) {
    throw new Error("Property not found");
  }

  property.isFeatured = !property.isFeatured;
  await property.save();

  const agent = await Agent.findById(property.createdBy);
  await createNotification(
    io,
    onlineUsers,
    agent.user,
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
  const {
    keyword,
    state,
    lga,
    minPrice,
    maxPrice,
    propertyType,
    location,
    rentFrequency,
    legalDocuments,
  } = query;
  const cacheKey = `property:search:${keyword || "_"}:${state || "_"}:${
    lga || "_"
  }:${location || "_"}:${minPrice || 0}:${maxPrice || "_"}:${
    propertyType || "_"
  }`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const queryFilter = { status: { $in: ["available", "rented", "sold"] } };
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
  const property = await Property.findOne({ propertyId });
  if (!property) throw new Error("Property not found");

  property.images = property.images.filter((img) => img.publicId !== imageId);
  if (property.thumbnail && property.thumbnail.publicId === imageId)
    property.thumbnail = {};

  await property.save();
  await redisClient.del(`property:${propertyId}`);

  return property.images;
};
