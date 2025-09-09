// server.js
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
app.use(bodyParser.json());

// Allow requests from Trello iframe
app.use(cors({ origin: 'https://trello.com' }));

// Trello Power-Up credentials
const TRELLO_KEY = '759d5e2164a9420a53c5672a04d92fb0';
const TRELLO_TOKEN = '77bcaa1c330cef0f2cdf839a446d17b69d67923cc95604ed69f2c2895c372c4c';

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

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
