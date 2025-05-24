// src/models/AgentKYC.js
import mongoose from 'mongoose';

const AgentKYCSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One KYC per user
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
  },
  idType: {
    type: String,
    enum: ['NIN', 'Driver’s License', 'Passport', 'Voter’s Card'],
    required: true,
  },
  idNumber: {
    type: String,
    required: true,
    trim: true,
  },
  idImage: {
    type: String,
    required: true, // Cloudinary URL for ID document
  },
  selfieWithCode: {
    type: String,
    required: true, // Cloudinary URL for selfie with verification code
  },
  verificationCode: {
    type: String, // Random code generated for selfie verification
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin who reviewed the KYC
  },
  rejectionReason: {
    type: String, // Reason for rejection, if applicable
  },
});

export default mongoose.model('AgentKYC', AgentKYCSchema);