// src/models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
  },
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
  },
  profile: {
    name: { type: String },
    photo: { type: String }, // Cloudinary URL
    state: { type: String },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Other",
    },
    about: {
      bio: { type: String }, // Detailed bio for agents
      specialties: [{ type: String }], // e.g., ["Residential", "Commercial"]
      credentials: [{ type: String }], // e.g., ["Licensed Realtor", "MBA"]
    },
    officeLocation: {
      address: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
  },
  preferences: {
    priceRange: { min: Number, max: Number },
    propertyType: {
      type: [String],
      enum: [
        "apartment",
        "house",
        "condo",
        "land",
        "single-family",
        "bungalow",
      ],
    },
    features: { type: [String] },
  },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Property" }],
  role: {
    type: String,
    enum: ["user", "agent", "admin"],
    default: "user",
  },
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("User", UserSchema);
