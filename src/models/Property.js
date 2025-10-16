import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
  propertyId: { type: String, unique: true, required: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ["sale", "rent", "shortlet"], 
    required: true 
  },

  propertyType: {
    type: String,
    enum: [
      "apartment",
      "duplex",
      "bungalow",
      "self-contain",
      "detached house",
      "semi-detached house",
      "terrace",
      "land",
      "shop",
      "office",
      "warehouse",
      "hotel",
      "event center",
      "filling station",
      "factory",
      "school",
      "others",
    ],
    required: true,
  },

  propertyUse: {
    type: String,
    enum: ["residential", "commercial", "mixed-use"],
    default: "residential",
  },

  price: { type: Number, required: true },
  rentFrequency: {
    type: String,
    enum: ["monthly", "quarterly", "annually", "none"],
    default: "none",
  },
  serviceCharge: { type: Number },
  inspectionFee: { type: Number },
  agentCommission: { type: Number },

  location: {
    address: { type: String },
    city: { type: String },
    lga: { type: String },
    state: { type: String, required: true },
    country: { type: String, default: "Nigeria" },
    coordinates: { lat: Number, lng: Number },
  },

  landSize: { type: String }, // e.g. "450sqm" or "1 plot"
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  toilets: { type: Number, default: 0 },
  parkingSpaces: { type: Number, default: 0 },
  furnished: { type: Boolean, default: false },
  serviced: { type: Boolean, default: false },
  newProperty: { type: Boolean, default: false },

  facilities: [{ type: String }], // e.g. ["Security", "Borehole", "24hrs Light", "POP Ceiling"]
  legalDocuments: [{ type: String }], // e.g. ["C of O", "Governor’s Consent"]
  images: [{ url: String, publicId: String }],
  thumbnail: { url: String, publicId: String },
  videoTourUrl: { type: String },

  status: {
    type: String,
    enum: ["available", "rented", "sold", "pending", "rejected"],
    default: "pending",
  },

  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },

  views: { type: Number, default: 0 },
  savedCount: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Property", PropertySchema);
