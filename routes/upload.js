const express = require('express');
const multer = require('multer');
const path = require('path');
const requireAuth = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `prod_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  }
});

router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
