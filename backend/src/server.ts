// src/server.ts
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index'; // Imports the configured router
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path'; 
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary';

// --- ADD THESE IMPORTS ---
import http from 'http'; // Import Node's built-in HTTP module
import { Server } from 'socket.io'; // Import the Server class from Socket.IO

// Load environment variables from .env
dotenv.config();

// Import models and associations (Sequelize relationships)
import './models/associations';

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use https URLs
});
console.log('[Cloudinary] SDK Configured. Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MISSING!');

const app = express();

// --- Database Connection Check ---
sequelize
  .authenticate()
  .then(() => console.log('Database connection established successfully.'))
  .catch((error) => console.error('Unable to connect to the database:', error.message));

// --- Security Middleware (Helmet) ---
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// --- CORS Configuration ---
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

// Allow preflight requests for all routes
app.options('*', cors());

// --- Body Parsers ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// =======================================================================
// === CORRECT PLACEMENT FOR SOCKET.IO INTEGRATION (BEFORE ROUTES) ===
// =======================================================================

// 1. Create an HTTP server instance from your Express app
const server = http.createServer(app);

// 2. Initialize Socket.IO and attach it to the HTTP server
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // Use the same origins as your main CORS config
        methods: ["GET", "POST"]
    }
});

// 3. Make the 'io' instance globally accessible to your controllers
// This allows you to call `req.app.get('io')` inside your route handlers
(app as any).io = io; 

// 4. Set up the connection handler for new clients
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

// =======================================================================
// === NOW REGISTER YOUR API ROUTES (AFTER 'io' IS ATTACHED) ===
// =======================================================================
app.use('/api', routes);
console.log('[SETUP] API routes mounted under /api');


// --- Error Handling Middleware ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR] Unhandled error:", err.stack);
  res.status(err.status || 500).json({
       error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
       ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
   });
});


// --- START THE SERVER ---
const PORT = process.env.PORT || 5001;

// 5. Start the HTTP server, not the Express app directly
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
