// server.js
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

const TRELLO_KEY = '759d5e2164a9420a53c5672a04d92fb0';
const TRELLO_TOKEN = '77bcaa1c330cef0f2cdf839a446d17b69d67923cc95604ed69f2c2895c372c4c';

app.post('/import-markdown', async (req, res) => {
  const { boardId, markdown } = req.body;

  if (!boardId || !markdown) {
    return res.status(400).json({ error: 'boardId and markdown required' });
  }

  try {
    // Fetch existing lists on the board
    const listsRes = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`);
    const lists = await listsRes.json();

    let currentListId = lists[0]?.id; // fallback to first list

    const lines = markdown.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Headings become lists
      if (line.startsWith('#')) {
        const listName = line.replace(/^#+\s*/, '');
        let list = lists.find(l => l.name === listName);
        if (!list) {
          // Create new list
          const createListRes = await fetch(`https://api.trello.com/1/lists?name=${encodeURIComponent(listName)}&idBoard=${boardId}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
            method: 'POST'
          });
          list = await createListRes.json();
          lists.push(list); // add to local list array
        }
        currentListId = list.id;
      }

      // List items become cards
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!currentListId) currentListId = lists[0].id;
        const cardName = line.slice(2);

        await fetch(`https://api.trello.com/1/cards?name=${encodeURIComponent(cardName)}&idList=${currentListId}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
          method: 'POST'
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
