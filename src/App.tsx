import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [rhymes, setRhymes] = useState<Array<{
    id: string;
    simplified: string;
    traditional: string;
    pinyin: string;
    definitions: string;
  }>>([]);
  const [self, setSelf] = useState(null);
  const [matchTones, setMatchTones] = useState(false);

  const fetchRhymes = async () => {
    const res = await axios.post(`http://localhost:3001/rhymes`, {
      hanzi: input,
      matchTones
    });

    setRhymes(res.data.rhymes);
    setSelf(res.data.self);
  };

  return (
    <main>
      <h1>Mandarin Rhyming Dictionary</h1>
      <p className="instructions">Please enter a Chinese character such as 海 or 你</p>


      <div className="search">
        <input
          className="search-bar"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter Chinese Character"
        />

        <div className="search__match-and-submit">
          <label className="match-tones">
            <input
              type="checkbox"
              checked={matchTones}
              onChange={() => setMatchTones(!matchTones)}
            />
            Match tones
          </label>

          <button className="find-rhymes" onClick={fetchRhymes}>Find Rhymes</button>
        </div>

      </div>


      {self && (
        <div className="rhyme-list">
          <div className="header">
            <div>Simplified</div>
            <div>Traditional</div>
            <div>Pinyin</div>
            <div>Definitions</div>
          </div>

          {rhymes.map((r) => (
            <div className="row" key={r.id}>
              <div className="cell">
                <span className="cell-label">Simplified</span>
                {r.simplified}
              </div>
              <div className="cell">
                <span className="cell-label">Traditional</span>
                {r.traditional}
              </div>
              <div className="cell">
                <span className="cell-label">Pinyin</span>
                {r.pinyin}
              </div>
              <div className="cell">
                <span className="cell-label">Definitions</span>
                {r.definitions}
              </div>
            </div>
          ))}
        </div>
      )}

      <footer>
        Copyright © <a href="https://joychiangling.com" target="_blank">Joy Ling</a>
      </footer>

    </main>
  );
}

export default App;