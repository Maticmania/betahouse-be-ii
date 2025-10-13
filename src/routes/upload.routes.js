import express from "express";
import { getUploadSignature, deleteImage } from "../controllers/upload.controller.js";
import { authenticate, restrictTo } from "../middlewares/auth.middleware.js";


const router = express.Router();

router.post("/signature", authenticate, getUploadSignature);
router.delete("/delete", authenticate, restrictTo("user"), deleteImage);

export default router;
