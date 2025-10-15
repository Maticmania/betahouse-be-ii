import { createPropertyService, updatePropertyService, deletePropertyService, listPropertiesService, listMyPropertiesService, getPropertyService, toggleWishlistService, getMyWishlistService, updatePropertyStatusService, toggleFeaturedService, searchPropertiesService, getGeneralPropertyStatsService } from "./property.service.js";

const createProperty = async (req, res) => {
  try {
    const property = await createPropertyService(
      req.body,
      req.agent,
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

const updateProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await updatePropertyService(
      propertyId,
      req.agent._id,
      req.user.role,
      req.body
    );

    res.status(200).json({ message: "Property updated", property });
  } catch (error) {
    console.log("Error updating properties", error.message, error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    await deletePropertyService(propertyId, req.agent._id, req.user.role);

    res.status(200).json({ message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const listProperties = async (req, res) => {
  try {
    const response = await listPropertiesService(req.query, req.user);
    return res.status(200).json(response);
  } catch (error) {
    console.error("listProperties error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const listMyProperties = async (req, res) => {
  try {
    const response = await listMyPropertiesService(req.agent._id, req.user.role, req.query);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const property = await getPropertyService(propertyId, req.user, ip);

    if (!property) {
      return res
        .status(404)
        .json({ message: "Property not found or not accessible" });
    }

    res.status(200).json(property);
  } catch (error) {
    console.error("getProperty error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const toggleWishlist = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const wishlist = await toggleWishlistService(req.user._id, propertyId);
    res.status(200).json({ message: "Wishlist updated", wishlist });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

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

const updatePropertyStatus = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { status } = req.body;
    const property = await updatePropertyStatusService(
      propertyId,
      status,
      req.app.get("io"),
      req.app.get("onlineUsers")
    );

    res.status(200).json({ message: `Property ${status}`, property });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const toggleFeatured = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await toggleFeaturedService(
      propertyId,
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

const searchProperties = async (req, res) => {
  try {
    const properties = await searchPropertiesService(req.query);
    res.status(200).json({ properties });
  } catch (error) {
    console.error("Error searching properties:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

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
  getGeneralPropertyStats,
  searchProperties,
};