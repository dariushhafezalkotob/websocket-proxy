const WebSocket = require('ws');
require('dotenv').config();

const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

server.on('connection', (clientWs) => {
  console.log('Client connected');

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
    // Send an initial message to OpenAI to keep the connection active
    openaiWs.send(JSON.stringify({ type: 'session.start' })); // Adjust based on OpenAI's requirements
  });

  // Forward client messages to OpenAI
  clientWs.on('message', (message) => {
    console.log('Received from client:', message.toString());
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(message);
    } else {
      console.log('OpenAI WebSocket not open');
      clientWs.send(JSON.stringify({ error: 'OpenAI connection not available' }));
    }
  });

  // Forward OpenAI responses to client
  openaiWs.on('message', (message) => {
    console.log('Received from OpenAI:', message.toString());
    clientWs.send(message);
  });

  // Handle errors
  openaiWs.on('error', (error) => {
    console.error('OpenAI WebSocket error:', error);
    clientWs.send(JSON.stringify({ error: 'OpenAI connection error' }));
  });

  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
  });

  // Handle disconnections
  clientWs.on('close', () => {
    console.log('Client disconnected');
    openaiWs.close();
  });

  openaiWs.on('close', () => {
    console.log('Disconnected from OpenAI Realtime API');
    clientWs.send(JSON.stringify({ error: 'OpenAI connection closed' }));
    clientWs.close();
  });

  // Keep connections alive with pings
  setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.ping();
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.ping();
  }, 30000); // Ping every 30 seconds
});

console.log(`Server running on port ${process.env.PORT || 8080}`);
