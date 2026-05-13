import express from 'express';
import cors from 'cors';
import MandarinRhymes from './src/lib/index.js';

const app = express();

app.use(cors());
app.use(express.json());

console.log("🔥 Server booting");

app.get('/rhymes', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/rhymes', async (req, res) => {
  try {
    console.log("1️⃣ request received");

    const { hanzi } = req.body;
    console.log("2️⃣ hanzi:", hanzi);

    const rhymes = new MandarinRhymes(hanzi);
    console.log("3️⃣ instance created");

    const result = await rhymes.getRhymes();
    console.log("4️⃣ got result");

    res.json(result);
  } catch (err) {
    console.error("🔥 ERROR:", err);
    res.status(500).json({ error: 'Something broke' });
  }
});

app.listen(3001, () => {
  console.log('🚀 Server running on port 3001');
});