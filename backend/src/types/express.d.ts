import { Request } from 'express';
import { Server } from 'socket.io';          // 👈 προσθήκη

export interface CustomRequest extends Request {
  body: any;
  params: { [key: string]: string };
  headers: any;
  user?: {
    id: number;
    username: string;
    user_type: string;
  };

  /** Socket.IO instance που έρχεται από το middleware */
  io?: Server;
  /** Πίνακας online χρηστών (userId ➜ socketId) */
  onlineUsers?: Map<number, string>;
}
