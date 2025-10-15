import express from "express";
import { createProperty, updateProperty, deleteProperty, listProperties, getProperty, toggleWishlist, updatePropertyStatus, toggleFeatured, listMyProperties, searchProperties, getGeneralPropertyStats, getMyWishlist } from "./property.controller.js";

import { authenticate, restrictTo, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = express.Router();

router.post("/", authenticate, restrictTo("agent"), createProperty);
router.put("/:propertyId", authenticate, restrictTo("agent"), updateProperty);
router.delete("/:propertyId", authenticate, restrictTo("agent", "admin"), deleteProperty);

router.get("/", optionalAuthenticate, listProperties);
router.get("/my", authenticate, restrictTo("agent", "admin"), listMyProperties);
router.get("/:propertyId", getProperty);

router.post("/:propertyId/wishlist", authenticate, toggleWishlist);
router.get("/saved/my", authenticate, getMyWishlist);

router.put("/:propertyId/status", authenticate, restrictTo("admin"), updatePropertyStatus);
router.put("/:propertyId/featured", authenticate, restrictTo("admin"), toggleFeatured);

router.get("/search/advanced", optionalAuthenticate, searchProperties);
router.get("/stats/general", getGeneralPropertyStats);

export default router;