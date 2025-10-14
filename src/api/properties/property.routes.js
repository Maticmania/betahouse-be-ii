import express from "express";
import { createProperty, updateProperty, deleteProperty, listProperties, getProperty, getPropertyBySlug, toggleWishlist, updatePropertyStatus, toggleFeatured, listMyProperties, searchProperties,              // 🔍 Filter properties by keyword
  getGeneralPropertyStats,       // 📊 Get global stats: total, available, sold
  getAgentPropertyStats,         // 📈 Get property stats for specific agent
  deletePropertyImage,           // 🗑️ Delete an image from a property
  createPropertyDraft,           // ✍️ Save a new property as draft
  submitPropertyDraft,           // 🚀 Submit a draft property for admin approval
  listMyDrafts,                  // 📄 Get current agent's drafts
  triggerPropertyNotification,   // 🔔 Trigger a reminder notification about a property
  getMyWishlist           // ❤️ List all properties saved by user
} from "./property.controller.js";

import { authenticate, restrictTo, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = express.Router();

// Property Management
router.post("/", authenticate, restrictTo("agent"), upload.array("images", 30), createProperty); // 🏠 Create new property
router.put("/:id", authenticate, restrictTo("agent"), upload.array("images", 30), updateProperty); // ✏️ Update property
router.delete("/:id", authenticate, restrictTo("agent", "admin"), deleteProperty); // ❌ Delete property

// Image Management
router.delete("/:propertyId/image/:imageId", authenticate, restrictTo("agent", "admin"), deletePropertyImage); // 🖼️ Delete a specific property image

// Listing
router.get("/", optionalAuthenticate, listProperties); // 📃 Public listing of available properties
router.get("/my", authenticate, restrictTo("agent", "admin"), listMyProperties); // 👤 Agent/admin properties
router.get("/:id", getProperty); // 🔎 Get a specific property by ID
router.get("/slug/:slug", getPropertyBySlug); // 🆔 Get property using SEO-friendly slug


// Wishlist
router.post("/:id/wishlist", authenticate, toggleWishlist); // ❤️ Add/remove property to/from wishlist
router.get("/saved/my", authenticate, getMyWishlist); // 📁 Get user's saved properties

// Moderation
router.put("/:id/status", authenticate, restrictTo("admin"), updatePropertyStatus); // ✅ Admin updates status (available/sold/etc.)
router.put("/:id/featured", authenticate, restrictTo("admin"), toggleFeatured); // ⭐ Admin toggles featured status

// Search + Stats
router.get("/search/advanced", optionalAuthenticate, searchProperties); // 🔍 Advanced search for properties
router.get("/stats/general", getGeneralPropertyStats); // 📊 General site-wide property stats
router.get("/stats/agent/:id", getAgentPropertyStats); // 📈 Stats for agent's properties

// Drafts
router.post("/draft", authenticate, restrictTo("agent"), createPropertyDraft); // ✍️ Save new draft
router.post("/:id/submit", authenticate, restrictTo("agent"), submitPropertyDraft); // 🚀 Submit draft for approval
router.get("/drafts/my", authenticate, restrictTo("agent"), listMyDrafts); // 📄 List my drafts

// Admin Tools
router.post("/:id/notify", authenticate, restrictTo("admin"), triggerPropertyNotification); // 🔔 Trigger property update notification

export default router;
