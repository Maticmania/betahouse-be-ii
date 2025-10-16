import express from "express";
import { createProperty, saveAsDraft, publishProperty, getMyDrafts, updateProperty, deleteProperty, listProperties, getProperty, toggleWishlist, updatePropertyStatus, toggleFeatured, listMyProperties, searchProperties, getGeneralPropertyStats, getMyWishlist,getPropertyBySlug } from "./property.controller.js";

import { authenticate, restrictTo, optionalAuthenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authenticate, restrictTo("agent"), createProperty);
router.post("/draft", authenticate, restrictTo("agent"), saveAsDraft);
router.put("/:propertyId/publish", authenticate, restrictTo("agent"), publishProperty);
router.get("/drafts", authenticate, restrictTo("agent"), getMyDrafts);
router.put("/:propertyId", authenticate, restrictTo("agent"), updateProperty);
router.delete("/:propertyId", authenticate, restrictTo("agent", "admin"), deleteProperty);

router.get("/", optionalAuthenticate, listProperties);
router.get("/my", authenticate, restrictTo("agent", "admin"), listMyProperties);
router.get("/slug/:slug", getPropertyBySlug);
router.get("/:propertyId", optionalAuthenticate, getProperty);

router.post("/:propertyId/wishlist", authenticate, toggleWishlist);
router.get("/saved/my", authenticate, getMyWishlist);

router.put("/:propertyId/status", authenticate, restrictTo("admin"), updatePropertyStatus);
router.put("/:propertyId/featured", authenticate, restrictTo("admin"), toggleFeatured);

router.get("/search/advanced", optionalAuthenticate, searchProperties);
router.get("/stats/general", getGeneralPropertyStats);

export default router;