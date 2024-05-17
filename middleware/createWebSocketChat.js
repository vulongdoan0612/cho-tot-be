import { WebSocket } from "ws";

export const webSocketCreateRoom = (wss, action, userReceive, userSend) => {
  const message = JSON.stringify({ action, userReceive, userSend });

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};
