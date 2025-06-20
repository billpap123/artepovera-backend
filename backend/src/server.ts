// src/server.ts
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();
import './models/associations';

/* -------------------------------------------------------------------------- */
/* 1.  Cloudinary – όπως ήταν                                                 */
/* -------------------------------------------------------------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key   : process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure    : true,
});

const app = express();

/* -------------------------------------------------------------------------- */
/* 2.  Helmet                                                                 */
/* -------------------------------------------------------------------------- */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

/* -------------------------------------------------------------------------- */
/* 3.  Express-CORS  (παραμένει credentials:true για τα REST calls)           */
/* -------------------------------------------------------------------------- */
const allowedOrigins = [
  'http://localhost:3000',
  'https://artepovera2.vercel.app'
];

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error(`CORS: Origin ${origin} not allowed.`)),
    methods     : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials : true            // ← αφορά ΜΟΝΟ τα API endpoints
  })
);
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------------------------------- */
/* 4.  SOCKET.IO χωρίς credentials                                            */
/* -------------------------------------------------------------------------- */
const server = http.createServer(app);

const io = new Server(server, {
  transports: ['websocket'],
  pingInterval: 25_000,     // default 25 s → maybe 40 s
  pingTimeout : 20_000,
  cors: { origin: allowedOrigins, methods: ['GET','POST'] }
});


/* ------------------------ online users map ------------------------------- */
const onlineUsers = new Map<number, string>();

io.on('connection', (socket) => {
  console.log(`🔌  user connected ${socket.id}`);

  socket.on('add_user', (userId: number) => {
    onlineUsers.set(userId, socket.id);
    socket.join(`user-${userId}`);          // ⭐ πρόσθεσέ το → μπαίνει σε προσωπικό room

    console.log(`user ${userId} ↔ socket ${socket.id}`);
  });

  socket.on('join_chat', (chatId: string) => socket.join(chatId));

  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) onlineUsers.delete(uid);
    }
    console.log(`🔥  socket disconnected ${socket.id}`);
  });
});

/* -------------------------------------------------------------------------- */
/* 5.  Routes                                                                 */
/* -------------------------------------------------------------------------- */
app.use('/api', routes(io, onlineUsers));

/* -------------------------------------------------------------------------- */
/* 6.  Error handler & start                                                  */
/* -------------------------------------------------------------------------- */
app.use((err: any, _req, res, _next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🚀  running on ${PORT}`));
