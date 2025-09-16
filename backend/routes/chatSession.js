// routes/chatSession.js
import express from 'express';
import authMiddleware from '../middleware/auth.js';
import ChatSession from '../models/ChatSession.js';
import ChatHistory from '../models/ChatHistory.js';
import Chunk from '../models/Chunk.js';
import User from '../models/User.js';

const router = express.Router();

// Toggle archive/unarchive chat session
router.post('/:sessionId/archive', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    session.archived = !session.archived;
    await session.save();

    res.json({ archived: session.archived });
  } catch (err) {
    console.error('Archive error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete chat session and all related data
router.delete('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Remove chat history
    await ChatHistory.deleteOne({ userId, chatSessionId: sessionId });

    // Remove chunks for all documents in this session
    await Chunk.deleteMany({ userId, documentId: { $in: session.documentIds } });

    // Remove documents from user's documents array
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.documents = user.documents.filter(doc => !session.documentIds.some(id => id.equals(doc._id)));
    await user.save();

    // Remove chat session itself
    await ChatSession.deleteOne({ _id: sessionId });

    res.json({ message: 'Chat session and related data deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;