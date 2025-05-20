// src/models/Property.js
import mongoose from 'mongoose';

const PropertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  location: {
    state: { type: String, required: true },
    country: { type: String, required: true },
    address: { type: String },
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  propertyType: {
    type: String,
    enum: ['apartment', 'house', 'condo', 'land'],
    required: true,
  },
  features: [{ type: String }], // e.g., ["pool", "garage"]
  images: [{ type: String }], // Cloudinary URLs
  thumbnail: { type: String }, // Cloudinary URL
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Property', PropertySchema);