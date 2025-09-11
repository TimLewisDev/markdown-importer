// server.js
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

// Allowed origins
const allowedOrigins = [
  'https://trello.com',
  'https://timlewisdev.github.io'
];

// CORS middleware with preflight handling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Explicit OPTIONS handler for all routes (some platforms route OPTIONS differently)
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  return res.sendStatus(204);
});

// Trello API credentials from environment variables
const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

// Helper to create a Trello list
async function createList(boardId, name) {
  const res = await fetch(
    `https://api.trello.com/1/lists?name=${encodeURIComponent(name)}&idBoard=${boardId}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error(`Failed to create list "${name}": ${await res.text()}`);
  return res.json();
}

// Helper to create a Trello card
async function createCard(listId, name) {
  const res = await fetch(
    `https://api.trello.com/1/cards?name=${encodeURIComponent(name)}&idList=${listId}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error(`Failed to create card "${name}": ${await res.text()}`);
  return res.json();
}

// Endpoint to import Markdown
app.post('/import-markdown', async (req, res) => {
  const { boardId, markdown } = req.body;

  if (!boardId || !markdown) {
    return res.status(400).json({ error: 'boardId and markdown are required' });
  }

  try {
    // Fetch existing lists
    const listsRes = await fetch(
      `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`
    );
    if (!listsRes.ok) throw new Error(await listsRes.text());
    const lists = await listsRes.json();

    let currentListId = lists[0]?.id;
    const lines = markdown.split('\n');

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Heading -> list
      if (line.startsWith('#')) {
        const listName = line.replace(/^#+\s*/, '');
        let list = lists.find(l => l.name === listName);
        if (!list) {
          list = await createList(boardId, listName);
          lists.push(list);
        }
        currentListId = list.id;
      }
      // Bullet -> card
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!currentListId) currentListId = lists[0]?.id;
        const cardName = line.slice(2).trim();
        await createCard(currentListId, cardName);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Listen on environment port (Vercel) or 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
