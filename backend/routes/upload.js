// routes/upload.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import authMiddleware from '../middleware/auth.js';
import User from '../models/User.js';
import Chunk from '../models/Chunk.js';
import ChatSession from '../models/ChatSession.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = String(req.user.id);
    const uploadPath = path.join(process.cwd(), 'uploads', userId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const filename = `${Date.now()}-${base}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'), false);
    }
    cb(null, true);
  }
});

async function extractTextFromPdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

function chunkText(text, maxChunkSize = 2000) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxChunkSize));
    start += maxChunkSize;
  }
  return chunks;
}

router.post('/', authMiddleware, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded or only non-PDF files were sent' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newDocs = [];

    for (const f of req.files) {
      try {
        const fileBuffer = await fs.promises.readFile(f.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check if a document with same name exists
        const existingDoc = user.documents.find(doc => doc.originalName === f.originalname);

        if (existingDoc) {
          // If file size differs, treat as new document
          if (existingDoc.size === f.size) {
            // Same file size, skip upload (duplicate)
            await fs.promises.unlink(f.path);
            console.log(`Duplicate file detected, skipping upload: ${f.originalname}`);
            continue;
          }
          // else: different size, proceed as new document
        }

        const webPath = `/uploads/${req.user.id}/${f.filename}`;

        // Add document metadata to user
        user.documents.push({
          originalName: f.originalname,
          filename: f.filename,
          path: webPath,
          size: f.size,
          uploadedAt: new Date(),
          hash: hash
        });

        newDocs.push(user.documents[user.documents.length - 1]);

        await user.save();

        // Extract text and chunk
        const text = await extractTextFromPdfBuffer(fileBuffer);
        if (!text || text.trim().length === 0) {
          console.warn(`No text extracted from PDF: ${f.originalname}`);
          continue;
        }

        const chunks = chunkText(text);

        const chunkDocs = chunks.map((chunkText, idx) => ({
          userId: user._id,
          documentId: user.documents[user.documents.length - 1]._id,
          chunkIndex: idx,
          text: chunkText
        }));

        await Chunk.insertMany(chunkDocs);
        console.log(`Inserted ${chunkDocs.length} chunks for document ${user.documents[user.documents.length - 1]._id} (${f.originalname})`);
      } catch (fileErr) {
        console.error(`Error processing file ${f.originalname}:`, fileErr);
        try {
          await fs.promises.unlink(f.path);
        } catch {}
      }
    }

    // Create chat sessions for new documents
    if (newDocs.length > 1) {
      const session = new ChatSession({
        userId: user._id,
        documentIds: newDocs.map(d => d._id)
      });
      await session.save();
    } else if (newDocs.length === 1) {
      const session = new ChatSession({
        userId: user._id,
        documentIds: [newDocs[0]._id]
      });
      await session.save();
    }

    return res.json({ message: 'Files uploaded', documents: user.documents });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get chat sessions for user (include archived flag)
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await ChatSession.find({ userId }).lean();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const sessionsWithDocs = sessions.map(session => {
      const docs = session.documentIds
        .map(docId => user.documents.find(d => d._id.equals(docId)))
        .filter(Boolean);
      return {
        _id: session._id,
        documentCount: docs.length,
        documentNames: docs.map(d => d.originalName),
        documents: docs,
        archived: session.archived || false
      };
    });

    res.json({ sessions: sessionsWithDocs });
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;