// src/models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String, // Required for email/password auth, optional for OAuth
  },
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  isEmailVerified: {
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
    name: { type: String, trim: true },
    photo: { type: String }, // Cloudinary URL
    state: { type: String },
    country: { type: String },
    phone: { type: String },
  },
  preferences: {
    priceRange: { min: Number, max: Number },
    propertyType: { type: [String], enum: ['apartment', 'house', 'condo', 'land'] },
    features: { type: [String] }, // e.g., ["pool", "garage"]
  },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  role: {
    type: String,
    enum: ['user', 'agent', 'admin'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('User', UserSchema);