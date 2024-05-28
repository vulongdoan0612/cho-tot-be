import { WebSocket } from "ws";

export const webSocketChat = (wss, action, idRoom) => {
  wss.on("connection", function connection(ws) {
    console.log("New WebSocket connection");

    const messageText = JSON.stringify({ action, idRoom });
    ws.on("message", function incoming(message) {
      console.log("Received message from client:", message);

      // Xử lý message ở đây
      wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageText);
        }
      });
      // wss.clients.forEach(function each(client) {
      //   if (client !== ws && client.readyState === WebSocket.OPEN) {
      //     client.send(message);
      //   }
      // });
    });
  });
};
