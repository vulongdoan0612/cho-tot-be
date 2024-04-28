import { WebSocket, WebSocketServer } from "ws";

export const webSocketMessage = (wss, action, postId) => {
  const message = JSON.stringify({ action, postId });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
