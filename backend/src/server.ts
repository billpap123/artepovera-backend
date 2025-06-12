// src/server.ts
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path'; 
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();
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
const allowedOrigins = ['http://localhost:3000', 'https://artepovera2.vercel.app'];
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

// --- Body Parsers ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SOCKET.IO SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log(`🔌 [Socket.IO] User connected: ${socket.id}`);
    socket.on('join_chat', (chatId: string) => {
        socket.join(chatId);
        console.log(`[Socket.IO] User ${socket.id} joined chat room: ${chatId}`);
    });
    socket.on('disconnect', () => {
        console.log(`🔥 [Socket.IO] User disconnected: ${socket.id}`);
    });
});

// --- ROUTE REGISTRATION (Using the new dependency injection pattern) ---
// We now pass 'io' directly into our router setup function.
app.use('/api', routes(io));
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
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
