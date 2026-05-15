import MandarinRhymes from '../src/lib/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { hanzi, matchTones } = req.body;

    const rhymes = new MandarinRhymes(hanzi, matchTones);

    const result = await rhymes.getRhymes();

    res.status(200).json(result);
  } catch (err) {
    console.error("RHYMES API ERROR:", err);
    res.status(500).json({
        error: err.message,
        stack: err.stack
    });
    }
}