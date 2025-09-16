// routes/chat.js
import express from 'express';
import authMiddleware from '../middleware/auth.js';
import axios from 'axios';
import Chunk from '../models/Chunk.js';
import ChatHistory from '../models/ChatHistory.js';
import ChatSession from '../models/ChatSession.js';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
dotenv.config();

const router = express.Router();

const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;

router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatSessionId, question } = req.body;

    if (!chatSessionId || !question) {
      return res.status(400).json({ message: 'chatSessionId and question are required' });
    }

    const session = await ChatSession.findById(chatSessionId);
    if (!session || !session.documentIds.length) {
      return res.status(404).json({ message: 'Chat session not found or empty' });
    }

    // Load chunks for all documents in session
    const chunks = await Chunk.find({
      userId,
      documentId: { $in: session.documentIds }
    }).sort('chunkIndex');

    if (!chunks.length) {
      return res.status(404).json({ message: 'No chunks found for this chat session' });
    }

    // Simple relevance: filter chunks containing any question word (improve as needed)
    const questionWords = question.toLowerCase().split(/\W+/);
    const relevantChunks = chunks.filter(chunk =>
      questionWords.some(word => chunk.text.toLowerCase().includes(word))
    );

    const textToSend = (relevantChunks.length ? relevantChunks : chunks)
      .map(c => c.text)
      .join('\n\n');

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that answers questions based on the provided document text.'
      },
      {
        role: 'user',
        content: `Document text:\n${textToSend}\n\nQuestion: ${question}`
      }
    ];

    const response = await axios.post(
      AZURE_OPENAI_ENDPOINT,
      {
        messages,
        max_tokens: 1000,
        temperature: 0.2
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY
        }
      }
    );

    const answer = response.data.choices?.[0]?.message?.content || 'No answer from AI';

    // Save chat history by chatSessionId
    let chatHistory = await ChatHistory.findOne({ userId, chatSessionId });
    if (!chatHistory) {
      chatHistory = new ChatHistory({ userId, chatSessionId, messages: [] });
    }
    chatHistory.messages.push({ question, answer });
    await chatHistory.save();

    return res.json({ answer });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message || err);
    return res.status(500).json({ message: 'Server error during chat' });
  }
});

// Get chat history for chatSessionId
router.get('/:chatSessionId/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatSessionId } = req.params;

    const chatHistory = await ChatHistory.findOne({ userId, chatSessionId });
    if (!chatHistory) {
      return res.json({ messages: [] });
    }

    return res.json({ messages: chatHistory.messages });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:chatSessionId/rate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatSessionId } = req.params;
    const { messageIndex, rating } = req.body;

    if (!['up', 'down'].includes(rating)) {
      return res.status(400).json({ message: 'Invalid rating value' });
    }

    const chatHistory = await ChatHistory.findOne({ userId, chatSessionId });
    if (!chatHistory) {
      return res.status(404).json({ message: 'Chat history not found' });
    }

    if (messageIndex < 0 || messageIndex >= chatHistory.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }

    chatHistory.messages[messageIndex].rating = rating;
    await chatHistory.save();

    res.json({ message: 'Rating updated' });
  } catch (err) {
    console.error('Rating update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export chat session as PDF
router.get('/:chatSessionId/export', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatSessionId } = req.params;

    const chatHistory = await ChatHistory.findOne({ userId, chatSessionId });
    if (!chatHistory) {
      return res.status(404).json({ message: 'Chat history not found' });
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="chat_${chatSessionId}.pdf"`);

    doc.pipe(res);

    doc.fontSize(16).text('Chat History', { underline: true });
    doc.moveDown();

    chatHistory.messages.forEach((msg, idx) => {
      doc.fontSize(12).fillColor('blue').text(`Q${idx + 1}: ${msg.question}`);
      doc.moveDown(0.2);
      doc.fillColor('black').text(`A: ${msg.answer}`);
      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
export default router;