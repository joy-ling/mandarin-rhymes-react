import express from 'express';
import cors from 'cors';
import MandarinRhymes from './src/lib/index.js';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/rhymes', async (req, res) => {
  try {
    const { hanzi, matchTones } = req.body;

    const rhymes = new MandarinRhymes(hanzi);
    if (matchTones) rhymes.withToneMatching();

    const result = await rhymes.getRhymes();

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something broke' });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});