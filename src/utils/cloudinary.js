import {cloudinary} from "../config/cloudinary.config.js";

export const generateSignature = (folder) => {
  const timestamp = Math.round(new Date().getTime() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  return { timestamp, signature };
};
