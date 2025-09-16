// middleware/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export default function authMiddleware(req, res, next) {
  const header = req.header('x-auth-token') || req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : header;
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
