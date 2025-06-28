import Property from "../../models/Property.js";
import User from "../../models/User.js";
import { cloudinary } from "../../config/cloudinary.config.js";
import { createNotification } from "../../services/notification.js";
import redisClient from "../../config/redis.config.js";
import slugify from "slugify";
// Helper function for AI-driven scoring
const calculatePreferenceScore = (property, user) => {
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

// Create a property (Agent only)
const createProperty = async (req, res) => {
  try {
    if (req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Only agents can create properties" });
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
    } = req.body;
    const files = req.files || [];

    if (files.length > 30) {
      return res.status(400).json({ message: "Maximum 30 images allowed" });
    }

    const imageUrls = await Promise.all(
      files.map(async (file) => {
        const safeUsername = req.user.username.replace(/[^a-zA-Z0-9-_]/g, "_");
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
      slug, // ✅ new slug field
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
      createdBy: req.user._id,
    });

    await property.save();

    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        "property",
        `New property "${title}" submitted by ${req.user.profile.name} (@${req.user.username}) for approval.`,
        property._id,
        "New Property Submission",
        "Property"
      );
    }

    res
      .status(201)
      .json({ message: "Property created, pending approval", property });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a property (Agent only, for their own properties)
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (property.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this property" });
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
    } = req.body;
    const files = req.files || [];

    if (property.images.length + files.length > 30) {
      return res.status(400).json({ message: "Maximum 30 images allowed" });
    }

    const newImageUrls = files.length
      ? await Promise.all(
          files.map(async (file) => {
            const safeUsername = req.user.username.replace(
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

    res.status(200).json({ message: "Property updated", property });
  } catch (error) {
    console.log("Error updating properties", error.message, error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a property (Agent or Admin)
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (
      property.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this property" });
    }

    // Delete images from Cloudinary
    for (const imageUrl of [...property.images, property.thumbnail]) {
      if (imageUrl) {
        const safeUsername = req.user.username.replace(/[^a-zA-Z0-9-_]/g, "_");
        const folderName = `Betahouse/${safeUsername}/properties`;
        const publicId = imageUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`Betahouse/${safeUsername}/properties/${publicId}`);
      }
    }

    await property.deleteOne();

    res.status(200).json({ message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// List properties with personalized sorting
const listProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      propertyType,
      state,
      location,
      features,
      forSale,
      sortBy = "score",
      order = "desc",
    } = req.query;

    const query = { status: { $in: ["available"] } };

    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    if (propertyType) query.propertyType = propertyType;
    if (state) query["location.state"] = state;
    if (location) query["location.city"] = location;
    if (features) query.features = { $all: features.split(",") };
    if (forSale !== undefined) query.forSale = forSale === "true";

    let properties = await Property.find(query)
      .populate("createdBy", "profile.name")
      .lean();

    // Apply AI-driven personalization for logged-in users
    if (req.user) {
      const user = await User.findById(req.user._id).lean();
      properties = properties.map((property) => ({
        ...property,
        score: calculatePreferenceScore(property, user),
      }));

      // Sort by score or other criteria
      properties.sort((a, b) => {
        if (sortBy === "score") {
          return order === "desc"
            ? (b.score || 0) - (a.score || 0)
            : (a.score || 0) - (b.score || 0);
        }
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return order === "desc" ? bVal - aVal : aVal - bVal;
      });
    } else {
      // Default sorting for non-logged-in users
      properties.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return order === "desc" ? bVal - aVal : aVal - bVal;
      });
    }

    // Paginate results
    const startIndex = (page - 1) * limit;
    const paginatedProperties = properties.slice(
      startIndex,
      startIndex + Number(limit)
    );
    const total = properties.length;

    res.status(200).json({
      properties: paginatedProperties,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// List properties for agent/admin
const listMyProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (req.user.role === "agent") {
      query.createdBy = req.user._id; // Agents see only their properties
    }
    if (status) {
      query.status = status; // Filter by status (pending, available, sold, rented)
    }

    const properties = await Property.find(query)
      .populate("createdBy", "profile.name username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Property.countDocuments(query);

    res.status(200).json({
      properties,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single property (increment views)
const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id).populate(
      "createdBy",
      "profile"
    );

    // Block normal users from seeing pending properties
    if (
      !property ||
      (property.status === "pending" &&
        req.user?.role !== "admin" &&
        property.createdBy._id.toString() !== req.user?._id.toString())
    ) {
      return res
        .status(404)
        .json({ message: "Property not found or not accessible" });
    }

    // Get client IP
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // Skip view increment for admin and property creator
    if (
      req.user?.role !== "admin" &&
      property.createdBy._id.toString() !== req.user?._id.toString()
    ) {
      const redisKey = `property:${id}:views:${ip}`;

      // Check if this IP already viewed this property recently
      const hasViewed = await redisClient.exists(redisKey);

      if (!hasViewed) {
        // Increment views and save
        property.views += 1;
        await property.save();

        // Mark IP as having viewed this property for 24 hours (86400 seconds)
        await redisClient.set(redisKey, "1", "EX", 86400);
      }
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle wishlist (User only)
const toggleWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    const property = await Property.findById(id);

    if (!property || property.status !== "available") {
      return res
        .status(404)
        .json({ message: "Property not found or not available" });
    }

    const index = user.wishlist.indexOf(id);
    if (index === -1) {
      user.wishlist.push(id);
      property.savedCount += 1;
    } else {
      user.wishlist.splice(index, 1);
      property.savedCount = Math.max(0, property.savedCount - 1);
    }

    await user.save();
    await property.save();

    res
      .status(200)
      .json({ message: "Wishlist updated", wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

  //get wishlist (User only)
const getMyWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "wishlist",
      match: { status: "available" },
      populate: { path: "createdBy", select: "profile.name username" },
    });

    res.status(200).json({
      wishlist: user.wishlist || [],
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch wishlist",
      error: error.message,
    });
  }
};


// Approve/reject property (Admin only)
const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["available", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    property.status = status;
    await property.save();

    const agent = await User.findById(property.createdBy);
    await createNotification(
      agent._id,
      "property", // match your schema
      `Your property "${property.title}" has been ${status}.`,
      property._id,
      `Property ${status === "available" ? "Approved" : "Rejected"}`, // title
      "Property" // relatedModel
    );

    res.status(200).json({ message: `Property ${status}`, property });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle featured property (Admin only)
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    property.isFeatured = !property.isFeatured;
    await property.save();

    const agent = await User.findById(property.createdBy);
    await createNotification(
      agent._id,
      "property", // match schema enum
      `Your property "${property.title}" has been ${
        property.isFeatured ? "featured" : "unfeatured"
      }.`,
      property._id,
      property.isFeatured ? "Property Featured" : "Property Unfeatured",
      "Property"
    );

    res.status(200).json({
      message: `Property ${property.isFeatured ? "featured" : "unfeatured"}`,
      property,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /properties/search
const searchProperties = async (req, res) => {
  try {
    const { keyword, state, lga, minPrice, maxPrice, propertyType } = req.query;
    const cacheKey = `property:search:${keyword || "_"}:${state || "_"}:${
      lga || "_"
    }:${minPrice || 0}:${maxPrice || "_"}:${propertyType || "_"}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.status(200).json(JSON.parse(cached));

    const query = { status: "available" };
    if (state) query["location.state"] = state;
    if (lga) query["location.lga"] = lga;
    if (propertyType) query.propertyType = propertyType;
    if (minPrice || maxPrice) query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
    if (keyword) query.$text = { $search: keyword };

    const properties = await Property.find(query).lean();

    await redisClient.set(cacheKey, JSON.stringify({ properties }), "EX", 600); // 10 minutes

    res.status(200).json({ properties });
  } catch (error) {
    console.error("Error searching properties:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// GET /properties/stats/general
const getGeneralPropertyStats = async (req, res) => {
  try {
    const stats = await redisClient.get("property:stats:general");
    if (stats) return res.status(200).json(JSON.parse(stats));

    const total = await Property.countDocuments();
    const available = await Property.countDocuments({ status: "available" });
    const sold = await Property.countDocuments({ status: "sold" });

    const result = { total, available, sold };
    await redisClient.setEx(
      "property:stats:general",
      3600,
      JSON.stringify(result)
    );

    res.status(200).json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch stats", error: err.message });
  }
};

// GET /properties/stats/agent/:id
const getAgentPropertyStats = async (req, res) => {
  try {
    const agentId = req.params.id;
    const cacheKey = `property:stats:agent:${agentId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.status(200).json(JSON.parse(cached));

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
    res.status(200).json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch agent stats", error: err.message });
  }
};

// POST /properties/:id/reviews
const leaveReview = async (req, res) => {
  res.status(501).json({ message: "Reviews not implemented yet." });
};

// GET /properties/:id/reviews
const getPropertyReviews = async (req, res) => {
  res.status(501).json({ message: "Reviews not implemented yet." });
};

// DELETE /properties/:propertyId/image/:imageId
const deletePropertyImage = async (req, res) => {
  try {
    const { propertyId, imageId } = req.params;
    const property = await Property.findById(propertyId);
    if (!property)
      return res.status(404).json({ message: "Property not found" });

    property.images = property.images.filter((img) => !img.includes(imageId));
    if (property.thumbnail.includes(imageId)) property.thumbnail = "";

    await property.save();
    await redisClient.del(`property:${propertyId}`); // Invalidate cache if exists

    res.status(200).json({ message: "Image removed", images: property.images });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to delete image", error: err.message });
  }
};

// POST /properties/draft
const createPropertyDraft = async (req, res) => {
  try {
    if (req.user.role !== "agent") {
      return res
        .status(403)
        .json({ message: "Only agents can create property drafts" });
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
    } = req.body;

    const files = req.files || [];
    if (files.length > 30) {
      return res.status(400).json({ message: "Maximum 30 images allowed" });
    }

    // Upload images to Cloudinary
    const safeUsername = req.user.username.replace(/[^a-zA-Z0-9-_]/g, "_");
    const folder = `Betahouse/${safeUsername}/properties`;

    const imageUrls = await Promise.all(
      files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder,
        });
        return result.secure_url;
      })
    );

    const thumbnail = imageUrls[0] || "";

    // Generate slug
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
      createdBy: req.user._id,
      status: "draft",
    });

    await property.save();

    res.status(201).json({ message: "Draft saved", property });
  } catch (err) {
    console.error("Error saving draft:", err);
    res
      .status(500)
      .json({ message: "Failed to save draft", error: err.message });
  }
};

// POST /properties/:id/submit
const submitPropertyDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property)
      return res.status(404).json({ message: "Property not found" });
    if (property.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to submit this draft" });
    }

    property.status = "pending";
    await property.save();

    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        "property",
        `New property "${property.title}" submitted by ${req.user.profile.name} (@${req.user.username}) for approval.`,
        property._id,
        "New Property Submission",
        "Property"
      );
    }

    await redisClient.del("property:search:*"); // Invalidate all property search cache
    res.status(200).json({ message: "Draft submitted for review", property });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to submit draft", error: err.message });
  }
};

// GET /properties/drafts/my
const listMyDrafts = async (req, res) => {
  try {
    const drafts = await Property.find({
      createdBy: req.user._id,
      status: "draft",
    });
    res.status(200).json({ drafts });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch drafts", error: err.message });
  }
};

// POST /properties/:id/notify
const triggerPropertyNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);
    if (!property)
      return res.status(404).json({ message: "Property not found" });

    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        "property",
        `Reminder for property update: ${property.title}`,
        property._id,
        "Update Needed",
        "Property"
      );
    }

    res.status(200).json({ message: "Notification triggered" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to trigger notification", error: err.message });
  }
};


// GET /properties/slug/:slug
const getPropertyBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const property = await Property.findOne({ slug }).populate(
      "createdBy",
      "profile.name username"
    );

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
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
