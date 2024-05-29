import { WebSocket } from "ws";

export const webSocketChat = (wss, action, idRoom) => {
  const messageText = JSON.stringify({ action, idRoom });
  // Broadcast the message to all clients
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageText);
    }
  });
};
