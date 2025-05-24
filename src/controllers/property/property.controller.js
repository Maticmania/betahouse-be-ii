// src/api/property/property.controller.js
import Property from '../../models/Property.js';
import User from '../../models/User.js';
import cloudinary from '../../config/cloudinary.config.js';
import { createNotification } from '../../services/notification.js';
import redisClient from '../../config/redis.config.js';
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
  if (preferences.propertyType && preferences.propertyType.includes(property.propertyType)) {
    score += 20;
  }

  // Feature match
  if (preferences.features) {
    const matchedFeatures = property.features.filter((f) => preferences.features.includes(f));
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
    if (req.user.role !== 'agent') {
      return res.status(403).json({ message: 'Only agents can create properties' });
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
      virtualSchema, // New field
    } = req.body;
    const files = req.files || [];

    if (files.length > 30) {
      return res.status(400).json({ message: 'Maximum 30 images allowed' });
    }

    const imageUrls = await Promise.all(
      files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'real-estate/properties',
        });
        return result.secure_url;
      })
    );

    const thumbnail = imageUrls[0] || '';

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
      virtualSchema: virtualSchema ? JSON.parse(virtualSchema) : [], // Parse JSON string
      images: imageUrls,
      thumbnail,
      createdBy: req.user._id,
    });

    await property.save();

    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await createNotification(
        admin._id,
        'property_submitted',
        `New property "${title}" submitted by ${req.user.profile.name} (@${req.user.username}) for approval.`,
        property._id
      );
    }

    res.status(201).json({ message: 'Property created, pending approval', property });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a property (Agent only, for their own properties)
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (property.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this property' });
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
      return res.status(400).json({ message: 'Maximum 30 images allowed' });
    }

    const newImageUrls = files.length
      ? await Promise.all(
          files.map(async (file) => {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: 'real-estate/properties',
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
    property.virtualSchema = virtualSchema ? JSON.parse(virtualSchema) : property.virtualSchema;
    property.images = [...property.images, ...newImageUrls];
    property.thumbnail = property.thumbnail || newImageUrls[0] || '';

    await property.save();

    res.status(200).json({ message: 'Property updated', property });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a property (Agent or Admin)
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (
      property.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized to delete this property' });
    }

    // Delete images from Cloudinary
    for (const imageUrl of [...property.images, property.thumbnail]) {
      if (imageUrl) {
        const publicId = imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`real-estate/properties/${publicId}`);
      }
    }

    await property.deleteOne();

    res.status(200).json({ message: 'Property deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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
      country,
      features,
      forSale,
      sortBy = 'score',
      order = 'desc',
    } = req.query;

    const query = { status: { $in: ['available'] } };

    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    if (propertyType) query.propertyType = propertyType;
    if (state) query['location.state'] = state;
    if (country) query['location.country'] = country;
    if (features) query.features = { $all: features.split(',') };
    if (forSale !== undefined) query.forSale = forSale === 'true';

    let properties = await Property.find(query)
      .populate('createdBy', 'profile.name')
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
        if (sortBy === 'score') {
            return order === 'desc'
            ? (b.score || 0) - (a.score || 0)
            : (a.score || 0) - (b.score || 0);
        }
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return order === 'desc' ? bVal - aVal : aVal - bVal;
        });
    } else {
      // Default sorting for non-logged-in users
            properties.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return order === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }

    // Paginate results
    const startIndex = (page - 1) * limit;
    const paginatedProperties = properties.slice(startIndex, startIndex + Number(limit));
    const total = properties.length;
    res.status(200).json({
      properties: paginatedProperties,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// List properties for agent/admin
const listMyProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (req.user.role === 'agent') {
      query.createdBy = req.user._id; // Agents see only their properties
    }
    if (status) {
      query.status = status; // Filter by status (pending, available, sold, rented)
    }

    const properties = await Property.find(query)
      .populate('createdBy', 'profile.name username')
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single property (increment views)
const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id).populate('createdBy', 'profile');

    // Block normal users from seeing pending properties
    if (
      !property ||
      (property.status === 'pending' &&
        req.user?.role !== 'admin' &&
        property.createdBy._id.toString() !== req.user?._id.toString())
    ) {
      return res.status(404).json({ message: 'Property not found or not accessible' });
    }

    // Get client IP
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Skip view increment for admin and property creator
    if (
      req.user?.role !== 'admin' &&
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
        await redisClient.set(redisKey, '1', 'EX', 86400);
      }
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle wishlist (User only)
const toggleWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    const property = await Property.findById(id);

    if (!property || property.status !== 'available') {
      return res.status(404).json({ message: 'Property not found or not available' });
    }

    const index = user.wishlist.indexOf(id);
    if (index === -1) {
      user.wishlist.push(id);
      property.savedCount += 1;
      await createNotification(
        user._id,
        'wishlist_update',
        `You added "${property.title}" to your wishlist.`,
        property._id
      );
    } else {
      user.wishlist.splice(index, 1);
      property.savedCount = Math.max(0, property.savedCount - 1);
      await createNotification(
        user._id,
        'wishlist_update',
        `You removed "${property.title}" from your wishlist.`,
        property._id
      );
    }

    await user.save();
    await property.save();

    res.status(200).json({ message: 'Wishlist updated', wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve/reject property (Admin only)
const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['available', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    property.status = status;
    await property.save();

    const agent = await User.findById(property.createdBy);
    await createNotification(
      agent._id,
      `property_${status}`,
      `Your property "${property.title}" has been ${status}.`,
      property._id
    );

    res.status(200).json({ message: `Property ${status}`, property });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle featured property (Admin only)
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    property.isFeatured = !property.isFeatured;
    await property.save();

    const agent = await User.findById(property.createdBy);
    await createNotification(
      agent._id,
      'property_featured',
      `Your property "${property.title}" has been ${property.isFeatured ? 'featured' : 'unfeatured'}.`,
      property._id
    );

    res.status(200).json({ message: `Property ${property.isFeatured ? 'featured' : 'unfeatured'}`, property });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export {
  createProperty,
  updateProperty,
  deleteProperty,
  listProperties,
  getProperty,
  toggleWishlist,
  updatePropertyStatus,
  toggleFeatured,
  listMyProperties,
};