import MandarinRhymes from '../src/lib/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { hanzi, matchTones } = req.body;

    const rhymes = new MandarinRhymes(hanzi);
    if (matchTones) rhymes.withToneMatching();

    const result = await rhymes.getRhymes();

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something broke' });
  }
}