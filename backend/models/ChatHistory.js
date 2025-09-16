// models/ChatHistory.js
import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  rating: { type: String, enum: ['up', 'down', null], default: null }, // new field
  createdAt: { type: Date, default: Date.now }
});

const ChatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chatSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
  messages: { type: [ChatMessageSchema], default: [] }
});

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);

export default ChatHistory;