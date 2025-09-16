// models/ChatSession.js
import mongoose from 'mongoose';

const ChatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
  archived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);

export default ChatSession;