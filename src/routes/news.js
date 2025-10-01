import express from 'express';

import { uploadNews, getNews, getDetailNews } from '../app/controllers/NewsController.js';
import uploadNewsImage from '../middlewares/upload.js';

const router = express.Router();

router.get('/', getNews);
router.get('/:id', getDetailNews);
router.post(
  '/upload',
  uploadNewsImage.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'blockImages', maxCount: 10 },
  ]),
  uploadNews
);

export default router;
