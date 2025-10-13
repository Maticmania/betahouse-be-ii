import mongoose from "mongoose";

const AgentApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  personal: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    dateOfBirth: String,
    gender: String,
    address: String,
    city: String,
    state: String,
  },
  professional: {
    licenseNumber: String,
    licenseExpiry: String,
    yearsExperience: String,
    specialization: [String],
    previousCompany: String,
    education: String,
    certifications: String,
  },
  business: {
    businessName: String,
    businessType: String,
    targetAreas: [String],
    priceRange: String,
    clientTypes: [String],
    marketingBudget: String,
  },
  documents: {
    profilePhoto: [{ url: String, publicId: String }],
    licenseDocument: [{ url: String, publicId: String }],
    idDocument: [{ url: String, publicId: String }],
    certificationDocuments: [{ url: String, publicId: String }],
    businessRegistration: [{ url: String, publicId: String }],
  },
  status: {
    type: String,
    enum: ["draft", "submitted", "under_review", "approved", "rejected"],
    default: "draft",
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
    ref: "User", // Admin who reviewed the KYC
  },
  rejectionReason: {
    type: String, // Reason for rejection, if applicable
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("AgentApplication", AgentApplicationSchema);
