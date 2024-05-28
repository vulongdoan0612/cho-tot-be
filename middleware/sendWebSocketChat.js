import { WebSocket } from "ws";

export const webSocketChat = (wss, action, idRoom, status) => {
  const message = JSON.stringify({ action, idRoom, status });
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
