import express from 'express';
import { uploadNews, getNews } from '../app/controllers/NewsController.js';
import uploadNewsImage from '../middlewares/upload.js';

const router = express.Router();

router.post(
  '/upload',
  uploadNewsImage.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'blockImages', maxCount: 10 },
  ]),
  uploadNews
);
router.get('/get', getNews);

export default router;
