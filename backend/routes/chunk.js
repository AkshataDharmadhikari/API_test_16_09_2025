//chunk.js
import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Chunk from '../models/Chunk.js';

const router = express.Router();

router.get('/:documentId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const chunks = await Chunk.find({ userId, documentId }).sort({ chunkIndex: 1 });

    res.json({ chunks });
  } catch (err) {
    console.error('Error fetching chunks:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
