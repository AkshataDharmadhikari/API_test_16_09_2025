// models/User.js
import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  filename: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  hash: { type: String, required: true, index: true }
});

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    documents: { type: [DocumentSchema], default: [] }
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);
export default User;
