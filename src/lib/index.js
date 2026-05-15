// import pinyinConvert from 'hanzi-to-pinyin';
import pinyinLib from 'pinyin';
import zhuyin from 'zhuyin';
import hanziFrequency from '@zurawiki/hanzi';
import fs from 'fs';
import crypto from "crypto";

const rhymingDictionary = JSON.parse(
  fs.readFileSync(new URL('./rhyming-dictionary.json', import.meta.url), 'utf-8')
);

const pinyin = pinyinLib.default;
const zhuyinify = zhuyin.default;

const toneMap = {
  ā: 1, á: 2, ǎ: 3, à: 4,
  ē: 1, é: 2, ě: 3, è: 4,
  ī: 1, í: 2, ǐ: 3, ì: 4,
  ō: 1, ó: 2, ǒ: 3, ò: 4,
  ū: 1, ú: 2, ǔ: 3, ù: 4,
  ǖ: 1, ǘ: 2, ǚ: 3, ǜ: 4,
};

// used to remove smybols which do not contribute to rhyming
const SYMBOLS_ARRAY = [",", "·"];

// used to substitute for Chinese words that contain English letters e.g. A咖
// note many of these zhuyin combinations do not exist in mandarin Chinese
// in these cases approximations exist for the purpose of determining rhyming
const ZHUYIN_ENGLISH_SUBS = {
  A: "ㄟ",
  B: "ㄅㄧ",
  C: "ㄙㄧ",
  D: "ㄉㄧ",
  E: "ㄧ",
  G: "ㄐㄧ",
  H: "ㄟㄔㄜ",
  K: "ㄎㄟ",
  L: "ㄝㄌㄜ",
  M: "ㄝㄇㄜ",
  N: "ㄝㄋ",
  O: "ㄡ",
  P: "ㄆㄧ",
  R: "ㄦ",
  S: "ㄝㄙㄜ",
  T: "ㄊㄧ",
  U: "ㄧㄨ",
  Q: "ㄎㄧㄨ",
  // no consonant v sound exists in mandarin
  // although ㄧ is sufficient to determine rhyming, ø is added for consistency
  V: "øㄧ",
  X: "ㄝㄜㄙ"
}

// represents zhyin tone markings: 2, 3, 4, 5 (neutral), respectively
// note that 1st tone in zhuyin is unmarked
// (as opposed to 5th/neutral tone being unmarked in pinyin)
const ZHUYIN_TONES = ["ˊ", "ˇ", "`", "˙"];

// represents pinyin zi, ci, si
// zhuyin vowel doesn't exist, replaced with ɯ
// or replaced with ø for fuzzy rhyming between these series (<- currently)
const DENTI_ALVEOLAR_SERIES = ["ㄗ", "ㄙ", "ㄘ"]

// represents pinyin zhi, chi, shi, ri
// zhuyin vowel doesn't exist replaced with ɨ
// or replaced with ø for fuzzy rhyming between these series (<- currently)
const RETROFLEX_SERIES = ["ㄓ", "ㄔ", "ㄕ", "ㄖ"];

// used to provide secondary vowel in cases when final vowel is nasal
// in these cases, the final vowel is not sufficient to determine rhyming
const NASAL_SERIES = ["ㄢ", "ㄣ", "ㄤ", "ㄥ"];
const MEDIAL_SERIES = ["ㄧ", "ㄨ", "ㄩ"]

function generateWordId(word) {
  return crypto
    .createHash('sha1')
    .update(`${word.simplified}|${word.traditional}|${word.pinyin}`)
    .digest('hex')
    .slice(0, 10); // shorter, UI-friendly
}

class MandarinRhymes {
  constructor(hanzi, matchTones = false) {
    this.hanzi = hanzi;
    this.matchTones = matchTones;
  }

  async getRhymes() {
    const cleanedInput = this.hanzi
    ?.trim()
    .replace(/\s+/g, '');
    const isChinese = /^\p{Script=Han}+$/u.test(cleanedInput);

    const messageText = {
      title: "No results.",
      body: "Are you sure you submitted a Chinese character?"
    };

    if (!cleanedInput || !isChinese) {
      return {
        self: null,
        rhymes: [],
        message: messageText
      };
    }

    this.hanzi = cleanedInput;

    try {

      // ---- STEP 1: pinyin conversion (with timeout) ----
      const pinyinResult = pinyin(this.hanzi, {
        style: pinyinLib.STYLE_TONE2 // numbered tones (ni3)
      });

      // flatten it
      const pinyinNumericArray = pinyinResult.map(item => item[0]);

      if (!pinyinNumericArray.length || !pinyinNumericArray[0]) {
        return {
          self: null,
          rhymes: [],
          message: messageText
        };
      }

      // ---- STEP 3: zhuyin ----
      const zhuyinArray = this.getZhuyinArray(pinyinNumericArray);

      // ---- STEP 4: tones ----
      const toneNumberArray = this.getToneNumberArray(pinyinNumericArray);

      const inputToneNumberArray = this.getToneNumberArray(pinyinNumericArray);
      this.inputToneNumberArray = inputToneNumberArray;
      
      // ---- STEP 5: vowels ----
      const vowelArray = this.getVowelArray(zhuyinArray);

      // ---- STEP 6: dictionary traversal ----
      let subDictionary = rhymingDictionary;

      for (let v = 0; v < vowelArray.length; v++) {
        const vowel = vowelArray[v];

        if (!subDictionary || !subDictionary[vowel]) {
          return {
            self: null,
            rhymes: [],
            message: messageText
          };
        }

        subDictionary = subDictionary[vowel];
      }


      this.rhymes = subDictionary.words || [];

      if (!this.rhymes.length) {
        return {
          self: null,
          rhymes: [],
          message: messageText
        };
      }

      // ---- STEP 7: separate self ----
      this.separateSelf();

      if (this.self) {
        const pinyinResult = pinyin(this.self.simplified, {
          style: pinyinLib.STYLE_TONE2
        });

        const pinyinArray = pinyinResult.map(item => item[0]);

        this.self.toneNumberArray = this.getToneNumberArray(pinyinArray);
      }

      this.rhymes = this.rhymes.map(word => {
        const pinyinResult = pinyin(word.simplified, {
          style: pinyinLib.STYLE_TONE2
        });

        const pinyinArray = pinyinResult.map(item => item[0]);

        return {
          ...word,
          toneNumberArray: this.getToneNumberArray(pinyinArray)
        };
      });

      // ---- STEP 8: tone filtering ----
      if (this.matchTones) {
        this.filterByToneMatching();
      }

      // ---- STEP 9: format output ----
      this.rhymes = this.rhymes.map(word => ({
        ...word,
        id: generateWordId(word),
        definitions: Array.isArray(word.definitions)
          ? word.definitions.join("; ")
          : word.definitions
      }));

      if (this.self?.definitions && Array.isArray(this.self.definitions)) {
        this.self.definitions = this.self.definitions.join("; ");
      }

      return {
        self: this.self || null,
        rhymes: this.rhymes,
        message: null
      };

    } catch (err) {
      throw err;
    }
  }

  // helper methods
  filterByToneMatching() {
    this.rhymes = this.rhymes.filter(this.matchesSelfTones.bind(this));
  }

  matchesSelfTones(word) {
    if (!this.inputToneNumberArray) return true;

    for (let i = 0; i < word.toneNumberArray.length; i++) {
      if (word.toneNumberArray[i] !== this.inputToneNumberArray[i]) {
        return false;
      }
    }
    return true;
  }

  getZhuyinArray(pinyinArray) {
    return pinyinArray.map((pinyin) => {
      var zhuyin;
      // used
      var letters = /^[A-Za-z]+$/;
      var hasEnglish = pinyin.match(letters) && pinyin.length == 1;
      // work-around for bug which causes ü to show up as undefined in zhuyin conversion
      var hasU = pinyin.indexOf("ü") != -1;
      var hasUE = pinyin.indexOf("üe") != -1;
      // word-around for bug which causes er-hua to show up as undefined in zhuyin conversion
      var hasErHua = pinyin == "r5";
      // check if Chinese word contains any English letters
      if (hasEnglish) {
        zhuyin = ZHUYIN_ENGLISH_SUBS[pinyin.toUpperCase()];
      } else if (hasU) {
        var initial = pinyin.substring(0, pinyin.indexOf("ü"));
        // dummyPinyin is used to get tone and initial
        var dummyPinyin = initial + "a" + pinyin.substring(pinyin.length - 1);
        var dummyZhuyin = zhuyinify(dummyPinyin)[0];
        var zhuyinTone = dummyZhuyin[dummyZhuyin.length - 1];
        // -2 to strip last two characters: tone and dummy "a"
        var zhuyinInitial = dummyZhuyin.substring(0, dummyZhuyin.length - 2);
        var zhuyinVowel = hasUE ? "ㄩㄝ" : "ㄩ";
        zhuyin = zhuyinInitial + zhuyinVowel + zhuyinTone;
      } else if (hasErHua) {
        zhuyin = "儿˙"
      } else {
        zhuyin = zhuyinify(pinyin)[0];
      }
      return zhuyin;
    });
  }

  getToneNumberArray(pinyinArray) {
    return pinyinArray.map(syllable => {
      for (const char of syllable) {
        if (toneMap[char]) {
          return toneMap[char];
        }
      }

      // no marked vowel → neutral tone
      return 5;
    });
  }

  getToneStrippedZhuyinArray(toneMarkedZhuyinArray) {
    return toneMarkedZhuyinArray.map(toneMarkedZhuyin => {
      var toneStrippedZhuyin;
      var lastChar = toneMarkedZhuyin[toneMarkedZhuyin.length - 1];
      var toneIndex = ZHUYIN_TONES.indexOf(lastChar);
      // if tone is not 1st tone, remove the final character (tone marking)
      if (toneIndex != -1) {
        toneStrippedZhuyin = toneMarkedZhuyin.substring(0, toneMarkedZhuyin.length - 1);
      }
      // else tone is 1st tone (unmarked), nothing to strip
      else {
        toneStrippedZhuyin = toneMarkedZhuyin;
      }
      return toneStrippedZhuyin
    });
  }

  getVowelArray(zhuyinArray) {
    var toneStrippedZhuyinArray = this.getToneStrippedZhuyinArray(zhuyinArray);
    return toneStrippedZhuyinArray.map(zhuyin => {
      var vowel;
      var lastChar = zhuyin[zhuyin.length - 1];
      var penultimateChar = zhuyin[zhuyin.length - 2];
      // if lastChar is in either denti alveolar or retroflex series, use dummy vowel
      // "ø" is used to represent the absence of a zhuyin character for the vowel
      if (DENTI_ALVEOLAR_SERIES.indexOf(lastChar) !== -1)
        //vowel = "ɯ";
        vowel = "ø";
      else if (RETROFLEX_SERIES.indexOf(lastChar) !== -1)
        //vowel = "ɨ";
        vowel = "ø";
      // for the following vowels (nasals): ㄢ, ㄤ, ㄣ, ㄥ
      // an additional vowel is needed to determine rhyming, so return last 2 chars
      else if (NASAL_SERIES.indexOf(lastChar) != -1) {
        // second vowel is equal to either a member of medial series or ø (representing no secondary vowel)
        if (penultimateChar == "ㄧ") {
          vowel = "ㄧ" + lastChar;
        }
        // in the case of ㄨ and ㄩ followed by the nasal ㄥ
        // the vowel sounds merge together (and therefore rhyme)
        // the combination ㄨ/ㄩ is represented by "u" here (which approximates their pinyin equivalents of u/ü)
        else if (penultimateChar == "ㄨ" || penultimateChar == "ㄩ") {
          vowel = (lastChar == "ㄥ" ? "u" : penultimateChar) + lastChar;
        } else {
          vowel = "ø" + lastChar;
        }
      } else {
        vowel = lastChar;
      }
      return vowel;
    })
  }

  getWordFrequency(hanzi) {
    var sumNumber = hanzi.split("").reduce((accumulator, currentValue) => {
      return parseInt(accumulator) + parseInt(hanziFrequency.getCharacterFrequency(currentValue).number);
    }, 0);
    return sumNumber / hanzi.length;
  }

  addAverageFrequencies() {
    this.rhymes = this.rhymes.map(word => {
      return { ...word,
        averageFrequency: this.getWordFrequency(word.simplified)
      };
    });
  }

  sortByFrequency() {
    this.rhymes = this.rhymes.sort((a, b) => a.averageFrequency - b.averageFrequency);
  }

  separateSelf() {
    // if word is the same as hanzi, filter out word from rhymes and set as self
    var newRhymes = [];
    this.rhymes.forEach(word => {
      if (word.simplified == this.hanzi || word.traditional == this.hanzi) {
        this.self = {
          ...word,
          id: generateWordId(word)
        };
      } else {
        newRhymes.push(word);
      }
    });
    this.rhymes = newRhymes;
  }
  

  withToneMatching() {
    this.matchTones = true;
    // return this to enable chaining;
    return this;
  }
}

export default MandarinRhymes;