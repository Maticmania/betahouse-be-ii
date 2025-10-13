import Property from "../../models/Property.js";
import User from "../../models/User.js";
import { cloudinary } from "../../config/cloudinary.config.js";
import { createNotification } from "../../services/notification.js";
import redisClient from "../../config/redis.config.js";
import { createPropertyService, updatePropertyService, deletePropertyService, listPropertiesService, listMyPropertiesService, getPropertyService, toggleWishlistService, getMyWishlistService, updatePropertyStatusService, toggleFeaturedService, searchPropertiesService, getGeneralPropertyStatsService } from "./property.service.js";
import { calculatePreferenceScore } from "./property.service.js";
import slugify from "slugify";

// Create a property (Agent only)
const createProperty = async (req, res) => {
  try {
    const property = await createPropertyService(
      req.body,
      req.user,
      req.files || [],
      req.app.get("io"),
      req.app.get("onlineUsers")
    );

    res.status(201).json({
      message: "Property created, pending approval",
      property,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// Update a property (Agent only, for their own properties)
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await updatePropertyService(
      id,
      req.user._id,
      req.user.role,
      req.body,
      req.files || []
    );

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
    await deletePropertyService(id, req.user._id, req.user.role);

    res.status(200).json({ message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// List properties with better performance
const listProperties = async (req, res) => {
  try {
    const response = await listPropertiesService(req.query, req.user);
    return res.status(200).json(response);
  } catch (error) {
    console.error("listProperties error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// List properties for agent/admin
const listMyProperties = async (req, res) => {
  try {
    const response = await listMyPropertiesService(req.user._id, req.user.role, req.query);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single property (increment views)
const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const property = await getPropertyService(id, req.user, ip);

    if (!property) {
      return res
        .status(404)
        .json({ message: "Property not found or not accessible" });
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
    const wishlist = await toggleWishlistService(req.user._id, id);
    res.status(200).json({ message: "Wishlist updated", wishlist });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//get wishlist (User only)
const getMyWishlist = async (req, res) => {
  try {
    const wishlist = await getMyWishlistService(req.user._id);
    res.status(200).json({ wishlist });
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
    const property = await updatePropertyStatusService(
      id,
      status,
      req.app.get("io"),
      req.app.get("onlineUsers")
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
    const property = await toggleFeaturedService(
      id,
      req.app.get("io"),
      req.app.get("onlineUsers")
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
    const properties = await searchPropertiesService(req.query);
    res.status(200).json({ properties });
  } catch (error) {
    console.error("Error searching properties:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /properties/stats/general
const getGeneralPropertyStats = async (req, res) => {
  try {
    const stats = await getGeneralPropertyStatsService();
    res.status(200).json(stats);
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

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await createNotification(
        io,
        onlineUsers,
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

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
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
