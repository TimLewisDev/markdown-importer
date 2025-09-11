

const allowedOrigins = [
  'https://trello.com',
  'https://timlewisdev.github.io'
];

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

async function createList(boardId, name) {
  const res = await fetch(
    `https://api.trello.com/1/lists?name=${encodeURIComponent(name)}&idBoard=${boardId}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error(`Failed to create list "${name}": ${await res.text()}`);
  return res.json();
}

async function createCard(listId, name) {
  const res = await fetch(
    `https://api.trello.com/1/cards?name=${encodeURIComponent(name)}&idList=${listId}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error(`Failed to create card "${name}": ${await res.text()}`);
  return res.json();
}

function setCors(res, origin) {
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ status: 'ok' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { boardId, markdown } = req.body || {};
    if (!boardId || !markdown) {
      res.status(400).json({ error: 'boardId and markdown are required' });
      return;
    }

    const listsRes = await fetch(
      `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`
    );
    if (!listsRes.ok) throw new Error(await listsRes.text());
    const lists = await listsRes.json();

    let currentListId = lists[0]?.id;
    const lines = markdown.split('\n');

    for (let raw of lines) {
      let line = raw.trim();
      if (!line) continue;

      if (line.startsWith('#')) {
        const listName = line.replace(/^#+\s*/, '');
        let list = lists.find(l => l.name === listName);
        if (!list) {
          list = await createList(boardId, listName);
          lists.push(list);
        }
        currentListId = list.id;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!currentListId) currentListId = lists[0]?.id;
        const cardName = line.slice(2).trim();
        await createCard(currentListId, cardName);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}


