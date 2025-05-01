const WebSocket = require('ws');
require('dotenv').config();

const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

server.on('connection', (clientWs) => {
  console.log('Client connected');

  // Connect to OpenAI Realtime API with beta header
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'openai-beta': 'realtime=v1'
    }
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');
    // Initialize session (adjust based on OpenAI docs)
    openaiWs.send(JSON.stringify({
      type: 'session.create',
      session: { model: 'gpt-4o-realtime-preview-2024-10-01' }
    }));
  });

  // Handle client messages
  clientWs.on('message', (message) => {
    console.log('Received from client:', message.toString());
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(message);
    } else {
      console.log('OpenAI WebSocket not open');
      clientWs.send(JSON.stringify({ error: 'OpenAI connection not available' }));
    }
  });

  // Handle OpenAI responses
  openaiWs.on('message', (message) => {
    console.log('Received from OpenAI:', message.toString());
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  });

  // Handle errors
  openaiWs.on('error', (error) => {
    console.error('OpenAI WebSocket error:', error.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: `OpenAI error: ${error.message}` }));
    }
  });

  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error.message);
  });

  // Handle disconnections
  clientWs.on('close', (code, reason) => {
    console.log(`Client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
    openaiWs.close();
  });

  openaiWs.on('close', (code, reason) => {
    console.log(`OpenAI disconnected. Code: ${code}, Reason: ${reason.toString()}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: `OpenAI connection closed: ${reason || 'Unknown reason'}` }));
      clientWs.close();
    }
  });

  // Keep connections alive
  setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.ping();
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.ping();
  }, 30000); // Ping every 30 seconds
});

console.log(`Server running on port ${process.env.PORT || 8080}`);
