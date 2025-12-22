import slugify from "slugify";
import Property from "../../models/Property.js";
import Agent from "../../models/Agent.js";
import User from "../../models/User.js";
import redisClient from "../../config/redis.config.js";
import { createNotification } from "../../services/notification.js";
import { setCache, getCache } from "../../utils/cache.js";
import { cloudinary } from "../../config/cloudinary.config.js";

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

  // Category match (sale, rent, shortlet)
  if (preferences.category && preferences.category === property.category) {
    score += 15;
  }

  // Property use match (residential, commercial, mixed-use)
  if (
    preferences.propertyUse &&
    preferences.propertyUse.includes(property.propertyUse)
  ) {
    score += 15;
  }

  // Location match
  if (preferences.locations) {
    const locationMatch =
      preferences.locations.includes(property.location?.state) ||
      preferences.locations.includes(property.location?.city) ||
      preferences.locations.includes(property.location?.lga);
    if (locationMatch) score += 25;
  }

  // Facilities match
  if (preferences.facilities && property.facilities) {
    const matchedFacilities = property.facilities.filter((f) =>
      preferences.facilities.includes(f)
    );
    score += matchedFacilities.length * 5;
  }

  // Bedrooms match
  if (preferences.bedrooms && property.bedrooms >= preferences.bedrooms) {
    score += 10;
  }

  // Boolean preferences
  if (preferences.furnished && property.furnished) score += 10;
  if (preferences.serviced && property.serviced) score += 10;
  if (preferences.newProperty && property.newProperty) score += 10;
  if (preferences.parkingRequired && property.parkingSpaces > 0) score += 8;

  // Featured boost
  if (property.isFeatured) score += 50;

  // Engagement metrics
  score += property.views * 0.1;
  score += property.savedCount * 0.5;

  return score;
};

const trackUserPreference = async (userId, property) => {
  if (!userId || !property) return;

  const key = `user:preferences:${userId}`;
  const multi = redisClient.multi();

  if (property.location?.state) {
    multi.zincrby(key, 3, `location:${property.location.state}`);
  }
  if (property.propertyType) {
    multi.zincrby(key, 2, `type:${property.propertyType}`);
  }
  if (property.bedrooms) {
    multi.zincrby(key, 1, `bedrooms:${property.bedrooms}`);
  }
  // Add other preferences as needed, e.g., price range, category, etc.

  await multi.exec();
  await redisClient.expire(key, 60 * 60 * 24 * 30); // 30 days expiration
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
  const property = await Property.findOne({
    propertyId: { $regex: new RegExp(`^${propertyId}$`, "i") },
  });

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
    city,
    category,
    propertyType,
    propertyUse,
    bedrooms,
    bathrooms,
    toilets,
    minPrice,
    maxPrice,
    parkingSpaces,
    furnished,
    serviced,
    newProperty,
    isFeatured,
    facilities,
    rentFrequency,
    sortBy = "score",
    sortOrder = "asc",
  } = query;

  const cacheKey = `properties:${JSON.stringify(query)}`;
  const cachedData = await redisClient.get(cacheKey);

  // Return cached data if available
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const queryFilter = { status: { $in: ["available", "rented", "sold"] } };
  const orConditions = [];

  // Category filter (sale, rent, shortlet)
  if (category && category !== "all") queryFilter.category = category;

  // Property type filter
  if (propertyType && propertyType !== "all")
    queryFilter.propertyType = propertyType;

  // Property use filter (residential, commercial, mixed-use)
  if (propertyUse && propertyUse !== "all")
    queryFilter.propertyUse = propertyUse;

  // Location filters
  if (state) queryFilter["location.state"] = state;
  if (lga) queryFilter["location.lga"] = lga;
  if (city) queryFilter["location.city"] = city;

  // Bedrooms and bathrooms filters
  if (bedrooms) queryFilter.bedrooms = Number(bedrooms);
  if (bathrooms) queryFilter.bathrooms = Number(bathrooms);
  if (toilets) queryFilter.toilets = Number(toilets);

  // Price range filter
  if (minPrice || maxPrice) {
    queryFilter.price = {};
    if (minPrice) queryFilter.price.$gte = Number(minPrice);
    if (maxPrice) queryFilter.price.$lte = Number(maxPrice);
  }

  // Parking spaces filter
  if (parkingSpaces !== undefined) {
    queryFilter.parkingSpaces = { $gte: Number(parkingSpaces) };
  }

  // Boolean filters
  if (furnished !== undefined) queryFilter.furnished = furnished === "true";
  if (serviced !== undefined) queryFilter.serviced = serviced === "true";
  if (newProperty !== undefined)
    queryFilter.newProperty = newProperty === "true";
  if (isFeatured !== undefined) queryFilter.isFeatured = isFeatured === "true";

  // Rent frequency filter
  if (rentFrequency && rentFrequency !== "all") {
    queryFilter.rentFrequency = rentFrequency;
  }

  // Facilities filter
  if (facilities) {
    const facilitiesArray = Array.isArray(facilities)
      ? facilities
      : facilities.split(",").map((f) => f.trim());
    if (facilitiesArray.length > 0) {
      queryFilter.facilities = { $all: facilitiesArray };
    }
  }

  // Search filter
  if (search) {
    orConditions.push(
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    );
  }

  // Location search (across multiple fields)
  if (query.location) {
    const regex = new RegExp(query.location, "i");
    orConditions.push(
      { "location.state": regex },
      { "location.city": regex },
      { "location.lga": regex },
      { "location.address": regex }
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
        path: "agent",
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
        path: "agent",
        populate: { path: "user", select: "profile.name" },
      })
      // .sort({ [sortBy]: sortDir })
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

  await setCache(cacheKey, response, 600);

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
      // Track user preference
      if (user && user._id) {
        await trackUserPreference(user._id.toString(), property);
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
  let isWishlisted;

  if (index === -1) {
    user.wishlist.push(propertyId);
    property.savedCount += 1;
    isWishlisted = true;
  } else {
    user.wishlist.splice(index, 1);
    property.savedCount = Math.max(0, property.savedCount - 1);
    isWishlisted = false;
  }

  await user.save();
  await property.save();

  return isWishlisted;
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
    city,
    state,
    propertyType,
    bedrooms,
    bathrooms,
    minPrice,
    maxPrice,
    minLandSize,
    maxLandSize,
    furnished,
    serviced,
    minParkingSpaces,
    maxParkingSpaces,
    amenities,
    sort,
    page = 1,
    limit = 10,
  } = query;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = { status: { $in: ["available", "rented", "sold"] } };

  if (city) queryFilter["location.city"] = new RegExp(city, "i");
  if (state) queryFilter["location.state"] = new RegExp(state, "i");
  if (propertyType) queryFilter.propertyType = propertyType;

  if (bedrooms) queryFilter.bedrooms = { $gte: parseInt(bedrooms, 10) };
  if (bathrooms) queryFilter.bathrooms = { $gte: parseInt(bathrooms, 10) };

  if (minPrice || maxPrice) {
    queryFilter.price = {};
    if (minPrice) queryFilter.price.$gte = parseInt(minPrice, 10);
    if (maxPrice) queryFilter.price.$lte = parseInt(maxPrice, 10);
  }

  if (furnished !== undefined) queryFilter.furnished = furnished === "true";
  if (serviced !== undefined) queryFilter.serviced = serviced === "true";

  if (minParkingSpaces || maxParkingSpaces) {
    queryFilter.parkingSpaces = {};
    if (minParkingSpaces)
      queryFilter.parkingSpaces.$gte = parseInt(minParkingSpaces, 10);
    if (maxParkingSpaces)
      queryFilter.parkingSpaces.$lte = parseInt(maxParkingSpaces, 10);
  }

  if (amenities) {
    const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
    queryFilter.facilities = { $all: amenitiesArray };
  }

  let sortCriteria = { createdAt: -1 }; // Default sort to newest
  if (sort) {
    switch (sort) {
      case "price_asc":
        sortCriteria = { price: 1 };
        break;
      case "price_desc":
        sortCriteria = { price: -1 };
        break;
      case "newest":
        sortCriteria = { createdAt: -1 };
        break;
      case "oldest":
        sortCriteria = { createdAt: 1 };
        break;
      // Add other sorting options as needed
      default:
        sortCriteria = { createdAt: -1 };
    }
  }

  const propertiesPromise = Property.find(queryFilter)
    .sort(sortCriteria)
    .skip(skip)
    .limit(limitNumber)
    .populate({
      path: "agent",
      select: "firstName lastName phone email", // Select fields from agent
    })
    .lean();

  const totalPromise = Property.countDocuments(queryFilter);

  const [properties, total] = await Promise.all([propertiesPromise, totalPromise]);

  const totalPages = Math.ceil(total / limitNumber);
  const hasNextPage = pageNumber < totalPages;
  const hasPrevPage = pageNumber > 1;

  return {
    properties,
    total,
    page: pageNumber,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
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

export const getSimilarPropertiesService = async (propertyId, limit = 5) => {
  const cacheKey = `property:${propertyId}:similar:limit:${limit}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const property = await Property.findOne({ propertyId });
  if (!property) {
    throw new Error("Property not found");
  }

  const queryFilter = {
    _id: { $ne: property._id }, // Exclude the current property
    status: { $in: ["available", "rented", "sold"] },
    propertyType: property.propertyType,
    category: property.category,
    "location.state": property.location.state,
  };

  const similarProperties = await Property.find(queryFilter)
    .limit(Number(limit))
    .lean();

  await setCache(cacheKey, JSON.stringify(similarProperties), 600);

  return similarProperties;
};

export const getPropertyAnalyticsService = async (propertyId) => {
  const cacheKey = `property:${propertyId}:analytics`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const property = await Property.findOne({ propertyId }).select(
    "views savedCount"
  );
  if (!property) {
    throw new Error("Property not found");
  }

  const analytics = { views: property.views, savedCount: property.savedCount };
  await setCache(cacheKey, JSON.stringify(analytics), 600);

  return analytics;
};

export const getTrendingProperties = async (limit = 20) => {
  const cacheKey = `properties:trending`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const trendingProperties = await Property.find({ status: "available" })
    .sort({ views: -1, savedCount: -1 })
    .limit(limit)
    .lean();

  await setCache(cacheKey, trendingProperties, 3600);
  return trendingProperties;
};

export const buildPersonalizedQuery = async (userId) => {
  const key = `user:preferences:${userId}`;
  const topPrefs = await redisClient.zrevrange(key, 0, 4, "WITHSCORES"); // Get top 5 preferences

  const query = { status: "available" };
  const orConditions = [];
  const preferenceValues = {
    location: [],
    type: [],
    bedrooms: [],
  };

  if (topPrefs.length > 0) {
    for (let i = 0; i < topPrefs.length; i += 2) {
      const [pref, score] = [topPrefs[i], parseFloat(topPrefs[i + 1])];
      const [prefType, prefValue] = pref.split(":");

      if (preferenceValues[prefType]) {
        preferenceValues[prefType].push(prefValue);
      }
    }

    if (preferenceValues.location.length > 0) {
      orConditions.push({
        "location.state": { $in: preferenceValues.location },
      });
      orConditions.push({
        "location.city": { $in: preferenceValues.location },
      });
      orConditions.push({ "location.lga": { $in: preferenceValues.location } });
    }
    if (preferenceValues.type.length > 0) {
      orConditions.push({ propertyType: { $in: preferenceValues.type } });
    }
    if (preferenceValues.bedrooms.length > 0) {
      // Assuming bedrooms preference means at least that many bedrooms
      orConditions.push({
        bedrooms: { $gte: Math.min(...preferenceValues.bedrooms.map(Number)) },
      });
    }
  }

  if (orConditions.length > 0) {
    query.$or = orConditions;
  } else {
    // Fallback for new users or no preferences
    // This will be handled in the controller by calling getTrendingProperties
    return {}; // Return empty query to indicate no personalized preferences
  }

  return query;
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
