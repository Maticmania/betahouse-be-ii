
import mongoose from "mongoose";

const AgentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  agentId: {
    type: String,
    unique: true,
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Agent", AgentSchema);
