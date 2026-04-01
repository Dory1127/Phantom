const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

const app = express();
app.use(cors());
app.use(express.json());

// 정적 파일 (public/)
app.use(express.static(path.join(__dirname, '../public')));

// API 라우트
app.use('/api/auth',  authRoutes);
app.use('/api/files', fileRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Phantom server running → http://localhost:${PORT}`);
});
