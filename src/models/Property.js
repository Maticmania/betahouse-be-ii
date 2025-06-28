// src/models/Property.js
import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  details: {
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    area: {
      totalStructure: { type: Number, default: 0 },
      totalInterior: { type: Number, default: 0 },
    },
    kitchen: {
      count: { type: Number, default: 1 },
      features: [{ type: String }],
    },
    heating: [
      {
        type: { type: String },
        features: [{ type: String }],
      },
    ],
    appliances: {
      included: [{ type: String }],
    },
    basement: {
      type: String,
      // enum: ['none', 'full', 'partially finished', 'unfinished'],
      default: "none",
    },
    fireplace: { type: Boolean, default: false },
  },
  status: {
    type: String,
    enum: ["available", "sold", "rented", "pending", "draft", "rejected"],
    default: "pending",
  },
  priceType: {
    type: String,
    enum: ["yearly", "total"],
    default: "total",
  },
  forSale: {
    type: Boolean,
    default: true,
  },
  price: {
    type: Number,
    required: true,
  },
  location: {
    state: { type: String, required: true },
    lga: { type: String },
    town: { type: String },
    country: { type: String, required: true, default: "Nigeria" },
    address: { type: String },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    frontageLength: { type: Number },
  },
  propertyType: {
    type: String,
    // enum: ['apartment', 'house', 'condo', 'land', 'single-family', 'bungalow'],
    required: true,
  },
  features: [{ type: String }],
  images: [{ type: String }], // Up to 30 Cloudinary URLs
  thumbnail: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  tourUrl: {
    type: String,
  },
  views: {
    type: Number,
    default: 0,
  },
  savedCount: {
    type: Number,
    default: 0,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  parking: {
    totalSpaces: { type: Number, default: 0 },
    features: [{ type: String }],
    attachedGarageSpaces: { type: Number, default: 0 },
    uncoveredSpaces: { type: Boolean, default: false },
    parkingSize: { type: String },
  },
  lot: {
    size: { type: Number },
    dimensions: { type: String },
    features: [{ type: String }],
  },
  construction: {
    type: { type: String },
    style: { type: String },
    materials: [{ type: String }],
    roof: [{ type: String }],
    yearBuilt: { type: Number },
  },
  virtualSchema: [
    {
      key: { type: String, required: true },
      value: { type: mongoose.Schema.Types.Mixed, required: true }, // Flexible value type
    },
  ],
});

export default mongoose.model("Property", PropertySchema);
