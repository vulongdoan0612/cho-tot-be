import { WebSocket, WebSocketServer } from "ws";

export const sendAnnouce = (wss, action, userId, announce) => {
  const message = JSON.stringify({ action, userId, announce });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
