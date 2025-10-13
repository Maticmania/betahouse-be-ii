import { generateSignature } from "../utils/cloudinary.js";
import {cloudinary} from "../config/cloudinary.config.js";

export const getUploadSignature = (req, res) => {
  try {
    const {_id : userId} = req.user;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    let folder = `Betahouse/${userId}`;

    const { timestamp, signature } = generateSignature(folder);

    res.json({
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (err) {
    console.error("Cloudinary signature error:", err);
    res.status(500).json({ message: "Error generating signature" });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ message: "public Id is required" });
    }

    if (!publicId.startsWith(`Betahouse/${req.user._id}`)) {
      return res.status(403).json({ message: "Not authorized to delete this image" });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok") {
      res.json({ message: "Image deleted successfully" });
    } else {
      res.status(400).json({ message: "Failed to delete image", result });
    }
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    res.status(500).json({ message: "Error deleting image" });
  }
};
