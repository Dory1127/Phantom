const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('./db');
const multer = require('multer');
const path   = require('path');

// 파일 저장 설정 (public/files/ 폴더에 저장)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/files'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '_' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },  // 50MB 제한
  fileFilter: (req, file, cb) => {
    cb(null, true);  // 모든 형식 허용
  }
});

/* ── JWT 인증 미들웨어 ── */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰' });
  }
}

/* ── GET /api/files  (전체 목록) ── */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.name, f.pos_x, f.pos_y, f.is_password_protected,
              f.created_at, f.userID as username, f.file_path
       FROM files f
       ORDER BY f.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[files GET]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ── POST /api/files  (파일 생성) ── */
router.post('/', auth, upload.single('file'), async (req, res) => {
  const { name, password } = req.body;
  if (!name) return res.status(400).json({ error: '파일 이름을 입력하세요' });
  if (!req.file) return res.status(400).json({ error: '파일을 선택하세요' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const filePath = `/files/${req.file.filename}`;
    const [result] = await conn.query(
      `INSERT INTO files (userID, name, file_path, is_password_protected)
       VALUES (?, ?, ?, ?)`,
      [req.user.userID, name, filePath, !!password]
    );
    const fileId = result.insertId;

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await conn.query(
        'INSERT INTO file_passwords (file_id, password_hash) VALUES (?, ?)',
        [fileId, hash]
      );
    }

    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [fileId]);
    res.status(201).json({ ...rows[0], username: req.user.userID });
  } catch (err) {
    await conn.rollback();
    console.error('[files POST]', err);
    res.status(500).json({ error: '파일 생성 실패' });
  } finally {
    conn.release();
  }
});

/* ── PATCH /api/files/:id/position ── */
router.patch('/:id/position', auth, async (req, res) => {
  const { pos_x, pos_y } = req.body;
  await pool.query(
    'UPDATE files SET pos_x=?, pos_y=? WHERE id=? AND userID=?',
    [pos_x, pos_y, req.params.id, req.user.userID]
  );
  res.json({ ok: true });
});

/* ── POST /api/files/:id/verify ── */
router.post('/:id/verify', async (req, res) => {
  const { password } = req.body;
  const [rows] = await pool.query(
    'SELECT password_hash FROM file_passwords WHERE file_id=?',
    [req.params.id]
  );
  if (!rows[0]) return res.json({ ok: false });
  const match = await bcrypt.compare(password, rows[0].password_hash);
  res.json({ ok: match });
});

/* ── DELETE /api/files/:id ── */
router.delete('/:id', auth, async (req, res) => {
  await pool.query(
    'DELETE FROM files WHERE id=? AND userID=?',
    [req.params.id, req.user.userID]
  );
  res.json({ ok: true });
});

module.exports = router;
