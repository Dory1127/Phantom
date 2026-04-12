const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('./db');

/* ───────────────────────────────────────
   POST /api/auth/register
   body: { userID, name, password }
─────────────────────────────────────── */
router.post('/register', async (req, res) => {
  const { userID, name, password } = req.body;

  // 입력값 검증
  if (!userID || !name || !password) {
    return res.status(400).json({ error: '모든 항목을 입력하세요' });
  }
  if (userID.length < 3 || userID.length > 30) {
    return res.status(400).json({ error: '아이디는 3~30자 사이여야 합니다' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(userID)) {
    return res.status(400).json({ error: '아이디는 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
  }

  try {
    // 중복 체크
    const [rows] = await pool.query(
      'SELECT userID FROM users WHERE userID = ?', [userID]
    );
    if (rows.length > 0) {
      return res.status(409).json({ error: '이미 사용 중인 아이디입니다' });
    }

    // 비밀번호 해시 & 저장
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (userID, name, password) VALUES (?, ?, ?)',
      [userID, name, hash]
    );

    res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

/* ───────────────────────────────────────
   POST /api/auth/login
   body: { userID, password }
─────────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { userID, password } = req.body;

  if (!userID || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE userID = ?', [userID]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다' });
    }

    const token = jwt.sign(
      { userID: user.userID, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, userID: user.userID, name: user.name });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

/* ───────────────────────────────────────
   GET /api/auth/me  (토큰 검증용)
─────────────────────────────────────── */
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '토큰 없음' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ userID: decoded.userID, name: decoded.name });
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰' });
  }
});

module.exports = router;
