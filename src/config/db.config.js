import mongoose from "mongoose";

export const connectDB = async (url) => {
  try {
    await mongoose.connect(url, {
      maxPoolSize: 10,               // optional: pool tuning
      serverSelectionTimeoutMS: 5000 // optional: fast fail if DB is unreachable
    });
    console.log("✅ Connected to MongoDB!");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected!');
  });
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB runtime error:', err);
  });
};
