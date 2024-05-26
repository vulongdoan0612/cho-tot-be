import { WebSocket, WebSocketServer } from "ws";

export const webSocketChat = (wss, action, idRoom, status) => {
  const message = JSON.stringify({ action, idRoom, status });
  console.log(message, client.readyState === WebSocket.OPEN, WebSocket.OPEN, client.readyState);
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
