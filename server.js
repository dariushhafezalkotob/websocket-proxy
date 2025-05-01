// server.js
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
  });

  // Forward messages from client to OpenAI
  clientWs.on('message', (message) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(message);
    }
  });

  // Forward messages from OpenAI to client
  openaiWs.on('message', (message) => {
    clientWs.send(message);
  });

  // Handle disconnections
  clientWs.on('close', () => {
    console.log('Client disconnected');
    openaiWs.close();
  });

  openaiWs.on('close', () => {
    console.log('Disconnected from OpenAI Realtime API');
    clientWs.close();
  });

  // Error handling
  openaiWs.on('error', (error) => {
    console.error('OpenAI WebSocket error:', error);
    clientWs.send('Error: Could not connect to OpenAI');
  });

  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
  });
});