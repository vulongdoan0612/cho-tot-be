import { WebSocket, WebSocketServer } from "ws";

export const viewPost = (wss, action, userId, postId) => {
  const message = JSON.stringify({ action, userId, postId });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
