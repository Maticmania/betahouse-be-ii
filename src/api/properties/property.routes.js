import express from "express";
import * as propertyController from "./property.controller.js";

import { authenticate, restrictTo, optionalAuthenticate } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authenticate, restrictTo("agent"), propertyController.createProperty);
router.post("/draft", authenticate, restrictTo("agent"), propertyController.saveAsDraft);
router.put("/:propertyId/publish", authenticate, restrictTo("agent"), propertyController.publishProperty);
router.get("/drafts", authenticate, restrictTo("agent"), propertyController.getMyDrafts);
router.put("/:propertyId", authenticate, restrictTo("agent"), propertyController.updateProperty);
router.delete("/:propertyId", authenticate, restrictTo("agent", "admin"), propertyController.deleteProperty);

router.get("/", optionalAuthenticate, propertyController.listProperties);
router.get("/my", authenticate, restrictTo("agent", "admin"), propertyController.listMyProperties);
router.get("/slug/:slug", propertyController.getPropertyBySlug);
router.get("/:propertyId", optionalAuthenticate, propertyController.getProperty);

router.post("/:propertyId/wishlist", authenticate, propertyController.toggleWishlist);
router.get("/saved/my", authenticate, propertyController.getMyWishlist);

router.put("/:propertyId/status", authenticate, restrictTo("admin"), propertyController.updatePropertyStatus);
router.put("/:propertyId/featured", authenticate, restrictTo("admin"), propertyController.toggleFeatured);

router.get("/search/advanced", optionalAuthenticate, propertyController.searchProperties);
router.get("/stats/general", propertyController.getGeneralPropertyStats);

export default router;