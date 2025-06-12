// src/server.ts
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary';

// --- ADD THIS ---
import http from 'http'; // 1. Import Node's built-in HTTP module
import { Server } from 'socket.io'; // 2. Import the Server class from Socket.IO

// Load environment variables
dotenv.config();

// Import models and associations
import './models/associations';

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
console.log('[Cloudinary] SDK Configured. Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MISSING!');

const app = express();

// Database Connection Check
sequelize
  .authenticate()
  .then(() => console.log('Database connection established successfully.'))
  .catch((error) => console.error('Unable to connect to the database:', error.message));

// Helmet configuration
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS CONFIGURATION
const allowedOrigins = [
  'http://localhost:3000',
  'https://artepovera2.vercel.app',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error(`CORS: Origin ${origin} not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

app.options('*', cors());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- SOCKET.IO INTEGRATION --- (ADD THIS ENTIRE BLOCK)

// 3. Create an HTTP server instance from your Express app
const server = http.createServer(app);

// 4. Initialize Socket.IO and attach it to the HTTP server
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // Use the same origins as your main CORS config
        methods: ["GET", "POST"]
    }
});

// 5. Make the 'io' instance globally accessible to your controllers
// This allows you to call `req.app.get('io')` inside your route handlers
(app as any).io = io; 

// 6. Set up the connection handler for new clients
io.on('connection', (socket) => {
    console.log(`🔌 [Socket.IO] User connected: ${socket.id}`);

    // Event for a user to join a specific chat room
    socket.on('join_chat', (chatId: string) => {
        socket.join(chatId);
        console.log(`[Socket.IO] User ${socket.id} joined chat room: ${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔥 [Socket.IO] User disconnected: ${socket.id}`);
    });
});

// --- END OF SOCKET.IO INTEGRATION ---


// USE YOUR MAIN API ROUTES
// This MUST come AFTER you've attached `io` to the app object
app.use('/api', routes);
console.log('[SETUP] API routes mounted under /api');

// ERROR HANDLING
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR] Unhandled error:", err.stack);
  res.status(err.status || 500).json({
       error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
       ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
   });
});

// START THE SERVER
const PORT = process.env.PORT || 5001;

// --- CHANGE THIS ---
// 7. Start the HTTP server, not the Express app directly
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});