const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const { router: recordingsRouter, setGFS } = require('./routes/recordings');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Mount the recordings router immediately (will work even without MongoDB)
//app.use('/api/recordings', recordingsRouter);

// Auth middleware
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const BASIC_USER = process.env.AUTH_USER || 'Mainuser';
const BASIC_PASS = process.env.AUTH_PASS || 'Dnewpassk';

function ensureAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const queryToken = req.query && req.query.token ? req.query.token : null;
  const token = headerToken || queryToken;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Login route to obtain JWT
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === BASIC_USER && password === BASIC_PASS) {
    const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Protect recordings API
app.use('/api/recordings', ensureAuth, recordingsRouter);
console.log('Recordings router mounted at /api/recordings');

// MongoDB connection
let mongoClient;
let gfs;

async function connectToMongoDB() {
  try {
    //    mongoClient = new MongoClient('mongodb://localhost:27017');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const db = mongoClient.db('streaming');

    setGFS(db);

    gfs = new (require('mongodb')).GridFSBucket(db);

    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectToMongoDB();

// Room management
const rooms = new Map(); // roomId -> { streamers: Set, viewers: Set }

// WebRTC signaling
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('No auth token'));
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return next(new Error('Auth failed'));
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join', (room) => {
    console.log(`Client ${socket.id} joining room: ${room}`);
    socket.join(room);

    // Initialize room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, { streamers: new Set(), viewers: new Set() });
    }

    const roomData = rooms.get(room);
    roomData.viewers.add(socket.id);

    console.log(`Room ${room} status:`, {
      streamers: roomData.streamers.size,
      viewers: roomData.viewers.size,
      total: roomData.streamers.size + roomData.viewers.size
    });

    // Notify existing peers in the room
    socket.to(room).emit('new-peer', { peerId: socket.id, isViewer: true });

    // If there are streamers in the room, notify the new viewer
    if (roomData.streamers.size > 0) {
      socket.emit('streamer-available', {
        streamerCount: roomData.streamers.size,
        message: 'Streamer is available in this room'
      });
      // Prompt streamers to send an offer immediately
      for (const streamerId of roomData.streamers) {
        io.to(streamerId).emit('request-offer', { viewerId: socket.id, room });
      }
    }
  });

  socket.on('streamer-join', (room) => {
    console.log(`Streamer ${socket.id} joining room: ${room}`);
    socket.join(room);

    // Initialize room if it doesn't exist
    if (!rooms.has(room)) {
      rooms.set(room, { streamers: new Set(), viewers: new Set() });
    }

    const roomData = rooms.get(room);
    roomData.streamers.add(socket.id);

    console.log(`Room ${room} status after streamer join:`, {
      streamers: roomData.streamers.size,
      viewers: roomData.viewers.size,
      total: roomData.streamers.size + roomData.viewers.size
    });

    // Notify all viewers that a streamer is available
    socket.to(room).emit('streamer-available', {
      streamerCount: roomData.streamers.size,
      message: 'Streamer joined the room'
    });
    // Ask new streamer to send offers to all current viewers
    for (const viewerId of roomData.viewers) {
      io.to(socket.id).emit('request-offer', { viewerId, room });
    }

    // Notify existing streamers
    socket.to(room).emit('new-peer', { peerId: socket.id, isStreamer: true });
  });

  socket.on('signal', ({ room, connectionId, data }) => {
    console.log(`Signal from ${socket.id} in room ${room}:`, data.type);
    socket.to(room).emit('signal', {
      connectionId,
      data,
      fromPeer: socket.id 
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove from all rooms
    for (const [roomId, roomData] of rooms.entries()) {
      if (roomData.streamers.has(socket.id)) {
        roomData.streamers.delete(socket.id);
        console.log(`Streamer ${socket.id} left room ${roomId}`);

        // Notify viewers if no streamers left
        if (roomData.streamers.size === 0) {
          io.to(roomId).emit('no-streamers', {
            message: 'No streamers available in this room'
          });
        }
      }
      if (roomData.viewers.has(socket.id)) {
        roomData.viewers.delete(socket.id);
        console.log(`Viewer ${socket.id} left room ${roomId}`);
      }

      // Clean up empty rooms
      if (roomData.streamers.size === 0 && roomData.viewers.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({ error: 'Route not found' });
});

const PORT =   process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at:`);
  console.log(`  - Local: http://localhost:${PORT}`);
  console.log(`  - Network: http://10.78.191.141:${PORT} ` );
  console.log(`WebRTC signaling server ready`);
  console.log(`Recordings API available at /api/recordings`);
});
