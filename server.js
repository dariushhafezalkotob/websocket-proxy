const WebSocket = require('ws');
require('dotenv').config();

const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

server.on('connection', (clientWs) => {
  console.log('Client connected');

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'openai-beta': 'realtime=v1'
    }
  });

  openaiWs.on('open', () => {
    console.log('Connected to OpenAI Realtime API');

    // Configure session with correct modalities
    openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        model: 'gpt-4o-realtime-preview-2024-10-01',
        modalities: ['text', 'audio'], // ✅ correct
        instructions: 'You are a friendly assistant.'
      }
    }));

    // Optional test message
    setTimeout(() => {
      openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'text', text: 'What is 2 + 2?' }
          ]
        }
      }));
      openaiWs.send(JSON.stringify({ type: 'response.create' }));
    }, 1000);
  });

  // Forward messages from client to OpenAI, with safety check
  clientWs.on('message', (message) => {
    console.log('Received from client:', message.toString());

    try {
      const parsed = JSON.parse(message);

      // 🚫 Block unsupported modality: 'input_audio'
      if (
        parsed.type === 'session.update' &&
        parsed.session?.modalities?.includes('input_audio')
      ) {
        console.warn('Blocked invalid modality from client:', parsed.session.modalities);
        clientWs.send(JSON.stringify({ error: "Invalid modality: 'input_audio'. Use 'text' or 'audio'." }));
        return;
      }

    } catch (e) {
      console.error('Invalid JSON received from client:', e.message);
      clientWs.send(JSON.stringify({ error: 'Invalid JSON format.' }));
      return;
    }

    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(message);
    } else {
      console.log('OpenAI WebSocket not open');
      clientWs.send(JSON.stringify({ error: 'OpenAI connection not available' }));
    }
  });

  // Forward messages from OpenAI to client
  openaiWs.on('message', (message) => {
    console.log('Received from OpenAI:', message.toString());
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  });

  // Error handling
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

  // Keep alive with pings
  const pingInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.ping();
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.ping();
  }, 30000);

  // Clean up ping interval on close
  clientWs.on('close', () => clearInterval(pingInterval));
  openaiWs.on('close', () => clearInterval(pingInterval));
});

console.log(`Server running on port ${process.env.PORT || 8080}`);
