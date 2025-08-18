import Property from "../../models/Property.js";
import User from "../../models/User.js";
import { cloudinary } from "../../config/cloudinary.config.js";
import { createNotification } from "../../services/notification.js";
import redisClient from "../../config/redis.config.js";
import slugify from "slugify";

const calculatePreferenceScore = (property, user) => {
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

const createProperty = async (user, propertyData, files, io, onlineUsers) => {
  if (user.role !== "agent") {
    throw new Error("Only agents can create properties");
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
  } = propertyData;
  const imageUrls = await Promise.all(
    files.map(async (file) => {
      const safeUsername = user.username.replace(/[^a-zA-Z0-9-_]/g, "_");
      const folderName = `Betahouse/${safeUsername}/properties`;
      const result = await cloudinary.uploader.upload(file.path, {
        folder: folderName,
      });
      return result.secure_url;
    })
  );

  const slug =
    slugify(title, { lower: true, strict: true }) +
    "-" +
    Math.round(Math.random() * 10000);
  const thumbnail = imageUrls[0] || "";

  const property = new Property({
    title,
    slug,
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
    images: imageUrls,
    thumbnail,
    createdBy: user._id,
  });

  await property.save();

  const keys = await redisClient.keys("properties:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
  }

  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      "property",
      `New property "${title}" submitted by ${user.profile.name} (@${user.username}) for approval.`,
      property._id,
      "New Property Submission",
      "Property"
    );
  }

  return property;
};

const updateProperty = async (propertyId, userId, propertyData, files) => {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new Error("Property not found");
  }

  if (property.createdBy.toString() !== userId.toString()) {
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
  } = propertyData;

  const newImageUrls = files.length
    ? await Promise.all(
        files.map(async (file) => {
          const safeUsername = (await User.findById(userId)).username.replace(
            /[^a-zA-Z0-9-_]/g,
            "_"
          );
          const folderName = `Betahouse/${safeUsername}/properties`;

          const result = await cloudinary.uploader.upload(file.path, {
            folder: folderName,
          });
          return result.secure_url;
        })
      )
    : [];

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
  property.images = [...property.images, ...newImageUrls];
  property.thumbnail = property.thumbnail || newImageUrls[0] || "";

  await property.save();

  const keys = await redisClient.keys("properties:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
  }

  return property;
};

const deleteProperty = async (propertyId, userId, userRole) => {
  const property = await Property.findById(propertyId);

  if (!property) {
    throw new Error("Property not found");
  }

  if (
    property.createdBy.toString() !== userId.toString() &&
    userRole !== "admin"
  ) {
    throw new Error("Not authorized to delete this property");
  }

  for (const imageUrl of [...property.images, property.thumbnail]) {
    if (imageUrl) {
      const safeUsername = (await User.findById(userId)).username.replace(
        /[^a-zA-Z0-9-_]/g,
        "_"
      );
      const folderName = `Betahouse/${safeUsername}/properties`;
      const publicId = imageUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(
        `Betahouse/${safeUsername}/properties/${publicId}`
      );
    }
  }

  await property.deleteOne();

  const keys = await redisClient.keys("properties:*");
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

const listProperties = async (req, res) => {
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
    order = "asc",
  } = queryParams;

    const cacheKey = `properties:${JSON.stringify(req.query)}`;
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  const query = { status: { $in: ["available"] } };

  if (propertyType && propertyType !== "all") {
    query.propertyType = propertyType;
  }
  if (state) query["address.state"] = state; // Changed to address.state
  if (lga) query.lga = lga; // Changed to lga
  if (forSale !== undefined) query.forSale = forSale === "true";
  if (bedrooms) query["details.bedrooms"] = { $gte: Number(bedrooms) };
  if (bathrooms) query["details.bathrooms"] = { $gte: Number(bathrooms) };
  if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
  if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
  if (minArea)
    query["details.area.totalStructure"] = {
      ...query["details.area.totalStructure"],
      $gte: Number(minArea),
    };
  if (maxArea)
    query["details.area.totalStructure"] = {
      ...query["details.area.totalStructure"],
      $lte: Number(maxArea),
    };
  if (yearBuiltMin)
    query["construction.yearBuilt"] = {
      ...query["construction.yearBuilt"],
      $gte: Number(yearBuiltMin),
    };
  if (yearBuiltMax)
    query["construction.yearBuilt"] = {
      ...query["construction.yearBuilt"],
      $lte: Number(yearBuiltMax),
    };
  if (hasParking !== undefined) {
    if (hasParking === "true") {
      query["parking.totalSpaces"] = { $gt: 0 };
    } else {
      query["parking.totalSpaces"] = 0;
    }
  }
  if (hasFireplace !== undefined)
    query["details.fireplace"] = hasFireplace === "true";
  if (isFeatured !== undefined) query.isFeatured = isFeatured === "true";
  if (features) {
    const featuresArray = Array.isArray(features)
      ? features
      : features.split(",");
    query.features = { $all: featuresArray };
  }
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Handle location search across multiple fields
  if (location) {
    const locationRegex = new RegExp(location, "i");
    query.$or = [
      ...(query.$or || []), // Preserve existing $or conditions if any
      { "address.state": locationRegex },
      { "address.city": locationRegex },
      { "address.street": locationRegex },
      { lga: locationRegex },
      { town: locationRegex },
    ];
  }

  console.log("List Properties Query:", JSON.stringify(query, null, 2));

  const sortDir = order === "asc" ? 1 : -1;

  let properties;
  if (sortBy === "score" && user) {
    let all = await Property.find(query)
      .populate("createdBy", "profile.name")
      .limit(100)
      .lean();

    all = all.map((p) => ({ ...p, score: calculatePreferenceScore(p, user) }));
    all.sort((a, b) => sortDir * (b.score - a.score));
    properties = all.slice(
      (page - 1) * limit,
      (page - 1) * limit + Number(limit)
    );
    const total = all.length;

    const response = {
      properties,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 600);
    return response;
  } else {
    properties = await Property.find(query)
      .populate("createdBy", "profile.name")
      .sort({ [sortBy]: sortDir })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Property.countDocuments(query);

    const response = {
      properties,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
    await redisClient.set(cacheKey, JSON.stringify(response), "EX", 600);
    return response;
  }
};

const getProperty = async (propertyId, user, ip) => {
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
    throw new Error("Property not found or not accessible");
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

const toggleWishlist = async (propertyId, userId) => {
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

const getMyWishlist = async (userId) => {
  const user = await User.findById(userId).populate({
    path: "wishlist",
    match: { status: "available" },
    populate: { path: "createdBy", select: "profile.name username" },
  });

  return user.wishlist || [];
};

const updatePropertyStatus = async (propertyId, status, io, onlineUsers) => {
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

const toggleFeatured = async (propertyId, io, onlineUsers) => {
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

const listMyProperties = async (userId, page, limit, status) => {
  const query = { createdBy: userId };
  if (status) {
    query.status = status;
  }

  const properties = await Property.find(query)
    .populate("createdBy", "profile.name username")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const total = await Property.countDocuments(query);

  return {
    properties,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

const getPropertyBySlug = async (slug) => {
  const property = await Property.findOne({ slug }).populate(
    "createdBy",
    "profile.name username"
  );

  if (!property) {
    throw new Error("Property not found");
  }

  return property;
};

const triggerPropertyNotification = async (propertyId, io, onlineUsers) => {
  const property = await Property.findById(propertyId);
  if (!property) throw new Error("Property not found");

  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      "property",
      `Reminder for property update: ${property.title}`,
      property._id,
      "Update Needed",
      "Property"
    );
  }
};

const listMyDrafts = async (userId) => {
  const drafts = await Property.find({
    createdBy: userId,
    status: "draft",
  });
  return drafts;
};

const submitPropertyDraft = async (propertyId, userId, io, onlineUsers) => {
  const property = await Property.findById(propertyId);

  if (!property) throw new Error("Property not found");
  if (property.createdBy.toString() !== userId.toString()) {
    throw new Error("Not authorized to submit this draft");
  }

  property.status = "pending";
  await property.save();

  const admins = await User.find({ role: "admin" });
  for (const admin of admins) {
    await createNotification(
      io,
      onlineUsers,
      admin._id,
      "property",
      `New property "${property.title}" submitted by ${
        (
          await User.findById(userId)
        ).profile.name
      } (@${(await User.findById(userId)).username}) for approval.`,
      property._id,
      "New Property Submission",
      "Property"
    );
  }

  await redisClient.del("property:search:*");

  return property;
};

const createPropertyDraft = async (user, propertyData, files) => {
  if (user.role !== "agent") {
    throw new Error("Only agents can create property drafts");
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
  } = propertyData;

  const imageUrls = await Promise.all(
    files.map(async (file) => {
      const safeUsername = user.username.replace(/[^a-zA-Z0-9-_]/g, "_");
      const folder = `Betahouse/${safeUsername}/properties`;

      const result = await cloudinary.uploader.upload(file.path, {
        folder,
      });
      return result.secure_url;
    })
  );

  const thumbnail = imageUrls[0] || "";

  const slugBase = slugify(title || "untitled-property", { lower: true });
  const slug = `${slugBase}-${Math.floor(Math.random() * 100000)}`;

  const property = new Property({
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
    images: imageUrls,
    thumbnail,
    slug,
    createdBy: user._id,
    status: "draft",
  });

  await property.save();

  return property;
};

const deletePropertyImage = async (propertyId, imageId) => {
  const property = await Property.findById(propertyId);
  if (!property) throw new Error("Property not found");

  property.images = property.images.filter((img) => !img.includes(imageId));
  if (property.thumbnail.includes(imageId)) property.thumbnail = "";

  await property.save();
  await redisClient.del(`property:${propertyId}`);

  return property.images;
};

const getPropertyReviews = async (propertyId) => {
  throw new Error("Reviews not implemented yet.");
};

const leaveReview = async (propertyId, userId, rating, comment) => {
  throw new Error("Reviews not implemented yet.");
};

const getAgentPropertyStats = async (agentId) => {
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

const getGeneralPropertyStats = async () => {
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

const searchProperties = async (queryParams) => {
  const { keyword, state, lga, minPrice, maxPrice, propertyType, location } = queryParams;
  const cacheKey = `property:search:${keyword || "_"}:${state || "_"}:${
    lga || "_"
  }:${location || "_"}:${minPrice || 0}:${maxPrice || "_"}:${propertyType || "_"}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const query = { status: "available" };

  if (location) {
    const locationRegex = new RegExp(location, "i");
    query.$or = [
      { "address.state": locationRegex },
      { "address.city": locationRegex },
      { "address.street": locationRegex },
      { lga: locationRegex },
      { town: locationRegex },
    ];
  } else {
    if (state) query["address.state"] = state;
    if (lga) query.lga = lga;
  }

  if (propertyType) query.propertyType = propertyType;
  if (minPrice || maxPrice) query.price = {};
  if (minPrice) query.price.$gte = Number(minPrice);
  if (maxPrice) query.price.$lte = Number(maxPrice);
  if (keyword) query.$text = { $search: keyword };

  console.log("Search Properties Query:", JSON.stringify(query, null, 2));

  const properties = await Property.find(query).lean();

  await redisClient.set(cacheKey, JSON.stringify({ properties }), "EX", 600);

  return properties;
};

export {
  createProperty,
  updateProperty,
  deleteProperty,
  listProperties,
  getProperty,
  toggleWishlist,
  getMyWishlist,
  updatePropertyStatus,
  toggleFeatured,
  listMyProperties,
  getPropertyBySlug,
  triggerPropertyNotification,
  listMyDrafts,
  submitPropertyDraft,
  createPropertyDraft,
  deletePropertyImage,
  getPropertyReviews,
  leaveReview,
  getAgentPropertyStats,
  getGeneralPropertyStats,
  searchProperties,
};
