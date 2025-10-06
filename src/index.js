// libs
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import newsRoutes from "./routes/news.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";

// config

const app = express();
const PORT = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: true, // chấp nhận tất cả origin
    credentials: true, // cho phép gửi cookie/authorization header
  })
);
app.disable("x-powered-by");
app.use(express.json()); // cho JSON lớn
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cookieParser());

// connect database
mongoose.set("strictQuery", false);
const connectDB = async () => {
  try {
    if (!process.env.MONGO_CONNECTION) {
      throw new Error("MONGO_CONNECTION environment variable is not set");
    }
    // JWT secret
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is not set");
    }

    await mongoose.connect(process.env.MONGO_CONNECTION);

    console.log("✅ connect database successful");
  } catch (error) {
    console.error("❌ connect database failed:", error.message);
  }
};

// routes
app.use("/api/v1/news", newsRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

app.listen(PORT, () => {
  connectDB();
  console.log(`Server running on port ${PORT}`);
});
