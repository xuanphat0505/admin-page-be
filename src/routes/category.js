import express from "express";
import {
  createCategory,
  getCategories,
} from "../app/controllers/CategoryController.js";

const router = express.Router();

router.get("/", getCategories);
router.post("/", createCategory);

export default router;
