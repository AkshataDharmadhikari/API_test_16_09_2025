// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import chatRoutes from './routes/chat.js';
import chatSessionRoutes from './routes/chatSession.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors()); // in prod limit origins
app.use(express.json());

// serve uploaded files


app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/chat', chatRoutes);
// routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chatSession', chatSessionRoutes);
// connect mongo and start
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/chatdoc';
mongoose
  .connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log(`Server listening ${PORT}`));
  })
  .catch(err => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });
