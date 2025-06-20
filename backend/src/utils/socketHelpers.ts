/* -------------------------------------------------------------------------- */
/*  utils/socketHelpers.ts (backend)                                          */
/* -------------------------------------------------------------------------- */
/**
 *  Βοηθητικές συναρτήσεις για να στέλνουμε real-time events
 *  χωρίς να επαναλαμβάνουμε το ίδιο emit-logic σε κάθε controller.
 */

import { Server } from 'socket.io';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */
export type OnlineUsersMap = Map<number, string>; // userId  -> socketId

/* -------------------------------------------------------------------------- */
/*  1. Push a *notification* to συγκεκριμένο χρήστη                           */
/* -------------------------------------------------------------------------- */
export const pushNotification = (
  io: Server,
  onlineUsers: OnlineUsersMap,
  recipientId: number,
  notificationPayload: any          // π.χ. notif.toJSON()
) => {
  // --- A. Στείλε σε room "user-<id>" (αν χρησιμοποιείς rooms) -------------
  io.to(`user-${recipientId}`).emit('new_notification', notificationPayload);

  // --- B. Επιπλέον ασφάλεια: άμεσο emit στο συγκεκριμένο socket -----------
  const socketId = onlineUsers.get(recipientId);
  if (socketId) io.to(socketId).emit('new_notification', notificationPayload);
};

/* -------------------------------------------------------------------------- */
/*  2. Push a *chat message* (προαιρετικό helper)                             */
/* -------------------------------------------------------------------------- */
/*  Αν χρησιμοποιείς παρόμοια λογική και για chat εκτός room, μπορείς να      */
/*  ξαναχρησιμοποιήσεις αυτό το helper.                                       */
export const pushMessage = (
  io: Server,
  onlineUsers: OnlineUsersMap,
  chatRoom: string,            // String(chat.chat_id)
  receiverId: number,
  messagePayload: any          // newMessage.toJSON()
) => {
  // 1) σε όλους όσοι έχουν ανοίξει το δωμάτιο
  io.to(chatRoom).emit('new_message', messagePayload);

  // 2) plus τον παραλήπτη αν είναι online αλλά όχι στο δωμάτιο
  const socketId = onlineUsers.get(receiverId);
  if (socketId) io.to(socketId).emit('new_message', messagePayload);
};
