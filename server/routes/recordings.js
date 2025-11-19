const express = require('express');
const multer = require('multer');
const { GridFSBucket, ObjectId } = require('mongodb');
const ffmpeg = require('fluent-ffmpeg');

const router = express.Router();

let gfs;

function setGFS(db) {
  gfs = new GridFSBucket(db, { bucketName: 'recordings' });
}

// Helper function to check if MongoDB is connected
function checkMongoDB() {
  if (!gfs) {
    throw new Error('MongoDB not connected. Please ensure MongoDB is running.');
  }
}

// Test endpoint to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Recordings router is working!' });
});

// Upload recording
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/', upload.single('file'), (req, res) => {
  console.log('POST /api/recordings - Upload request received');
  try {
    checkMongoDB();
    if (!req.file) return res.status(400).send('No file uploaded');
    const uploadStream = gfs.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { uploadedAt: new Date() },
    });
    uploadStream.end(req.file.buffer);
    uploadStream.on('finish', (file) => res.status(201).json(file));
    uploadStream.on('error', (err) => res.status(500).send(err.message));
  } catch (error) {
    console.error('Upload error:', error);
    res.status(503).json({ error: error.message });
  }
});

// List recordings
router.get('/', async (req, res) => {
  console.log('GET /api/recordings - List request received');
  try {
    checkMongoDB();
    const files = await gfs.find().toArray();
    res.json(files);
  } catch (error) {
    console.error('Error listing recordings:', error);
    res.status(503).json({ error: error.message });
  }
});

// Stream/download a recording with quality options
router.get('/:id', (req, res) => {
  const { quality = 'original' } = req.query;
  console.log(`GET /api/recordings/:id - Stream request received for ID: ${req.params.id} with quality: ${quality}`);
  
  try {
    checkMongoDB();
    const id = new ObjectId(req.params.id);
    
    // If original quality is requested, stream directly
    if (quality === 'original') {
      console.log('Streaming original quality');
      return gfs.openDownloadStream(id).pipe(res);
    }
    
    // For other qualities, transcode on the fly
    console.log(`Transcoding to ${quality} quality`);
    
    // Set appropriate headers based on quality
    if (quality === 'audio') {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="recording-${quality}-${id}.mp3"`);
    } else {
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Disposition', `attachment; filename="recording-${quality}-${id}.webm"`);
    }
    
    // Get the original file stream
    const downloadStream = gfs.openDownloadStream(id);
    
    // Configure ffmpeg based on quality
    let ffmpegCommand = ffmpeg(downloadStream);
    
    switch (quality) {
      case 'high':
        ffmpegCommand
          .outputOptions([
            '-vf', 'scale=1280:720',
            '-b:v', '2500k',
            '-b:a', '128k',
            '-c:v', 'libvpx',
            '-c:a', 'libopus'
          ])
          .format('webm');
        break;
        
      case 'medium':
        ffmpegCommand
          .outputOptions([
            '-vf', 'scale=854:480',
            '-b:v', '1000k',
            '-b:a', '96k',
            '-c:v', 'libvpx',
            '-c:a', 'libopus'
          ])
          .format('webm');
        break;
        
      case 'low':
        ffmpegCommand
          .outputOptions([
            '-vf', 'scale=640:360',
            '-b:v', '500k',
            '-b:a', '64k',
            '-c:v', 'libvpx',
            '-c:a', 'libopus'
          ])
          .format('webm');
        break;
        
      case 'audio':
        ffmpegCommand
          .outputOptions([
            '-vn',  // No video
            '-c:a', 'libmp3lame',
            '-b:a', '128k'
          ])
          .format('mp3');
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid quality parameter' });
    }
    
    // Handle ffmpeg errors
    ffmpegCommand.on('error', (err) => {
      console.error('FFmpeg error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Transcoding failed' });
      }
    });
    
    // Handle ffmpeg progress (optional)
    ffmpegCommand.on('progress', (progress) => {
      console.log(`Transcoding progress: ${progress.percent}% done`);
    });
    
    // Pipe the transcoded output to response
    ffmpegCommand.pipe(res, { end: true });
    
  } catch (e) {
    console.error('Error streaming/transcoding recording:', e);
    if (e.message.includes('MongoDB not connected')) {
      res.status(503).json({ error: e.message });
    } else if (e.name === 'BSONTypeError') {
      res.status(400).json({ error: 'Invalid ID format' });
    } else {
      res.status(500).json({ error: 'Failed to process recording' });
    }
  }
});

// Delete a recording
router.delete('/:id', async (req, res) => {
  console.log('DELETE /api/recordings/:id - Delete request received for ID:', req.params.id);
  
  try {
    checkMongoDB();
    const id = new ObjectId(req.params.id);
    console.log('Converted to ObjectId:', id);
    
    // Check if file exists before deleting
    const files = await gfs.find({ _id: id }).toArray();
    if (files.length === 0) {
      console.log('File not found with ID:', id);
      return res.status(404).json({ error: 'Recording not found' });
    }
    
    console.log('File found, attempting to delete:', files[0].filename);
    await gfs.delete(id);
    console.log('File deleted successfully');
    
    res.status(200).json({ message: 'Recording deleted successfully' });
  } catch (e) {
    console.error('Error deleting recording:', e);
    if (e.message.includes('MongoDB not connected')) {
      res.status(503).json({ error: e.message });
    } else if (e.name === 'BSONTypeError') {
      res.status(400).json({ error: 'Invalid ID format' });
    } else {
      res.status(500).json({ error: 'Failed to delete recording' });
    }
  }
});

module.exports = { router, setGFS }; 
