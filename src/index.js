// libs
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import newsRoutes from './routes/news.js';

// config
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json()); // cho JSON lớn
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cookieParser());

// connect database
mongoose.set('strictQuery', false);
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_CONNECTION);
    console.log('connect database successful');
  } catch (error) {
    console.log('connect database failed:', error.message);
  }
};

// routes
app.use('/api/v1/news', newsRoutes);

app.listen(PORT, () => {
  connectDB();
  console.log(`Server running on port ${PORT}`);
});
