import express from "express";
import { getUploadSignature, deleteImage } from "../controllers/upload.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";


const router = express.Router();

router.post("/signature", authenticate, getUploadSignature);
router.post("/delete", authenticate, deleteImage);
export default router;
