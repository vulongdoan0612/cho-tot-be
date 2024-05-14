import { WebSocket, WebSocketServer } from "ws";

export const webSocketMessage = (wss, action, postId, userId) => {
  const message = JSON.stringify({ action, postId, userId });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
