// src/models/AgentKYC.js
import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One KYC per user
  },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  idType: { type: String, enum: ['NIN', 'Driver’s License', 'Passport'], required: true },
  idNumber: { type: String, required: true },
  idImage: { type: String, required: true }, // Cloudinary URL
  selfieWithCode: { type: String, required: true }, // Cloudinary URL
  voice: { type: String }, // Cloudinary URL (optional audio)
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
});

export default mongoose.model('AgentKYC', AgentSchema);