//Chunk.js
import mongoose from 'mongoose';

const ChunkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true }
}, {
  timestamps: true
});

const Chunk = mongoose.model('Chunk', ChunkSchema);

export default Chunk;
