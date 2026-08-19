// util.js

/**
 * 指定されたミリ秒だけ待機する
 * @param {number} ms - 待機するミリ秒数
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DAKUON = {
    "ガ": "カ",
    "ギ": "キ",
    "グ": "ク",
    "ゲ": "ケ",
    "ゴ": "コ",
    "ザ": "サ",
    "ジ": "シ",
    "ズ": "ス",
    "ゼ": "セ",
    "ゾ": "ソ",
    "ダ": "タ",
    "ヂ": "チ",
    "ヅ": "ツ",
    "デ": "テ",
    "ド": "ト",
    "バ": "ハ",
    "ビ": "ヒ",
    "ブ": "フ",
    "ベ": "ヘ",
    "ボ": "ホ",
    "ヴ": "ウ"
};

/**
 * 濁音かどうかを判定する
 * @param {string} char - 判定する文字
 * @returns {boolean} - 濁音であれば true
 */
export function isDakuon(char) {
    return DAKUON.hasOwnProperty(char);
}

/**
 * 濁点を除去する
 * @param {string} str - 対象の文字列
 * @returns {string} - 濁点を除去した文字列
 */
export function removeDakuten(str) {
    let result = '';

    for (const char of str) {
        result += DAKUON.hasOwnProperty(char) ? DAKUON[char] : char;
    }

    return result;
}

/**
 * 現在の要素と次の要素をセットで yield するジェネレータ
 * @param {Iterable} iterable - 対象のイテラブル
 * @yields {{char: string, nextChar: string|null}}
 */
export function* pairWithNext(iterable) {
    const iterator = iterable[Symbol.iterator]();
    let current = iterator.next();

    while (!current.done) {
        const next = iterator.next();
        yield { char: current.value, nextChar: next.done ? null : next.value };
        current = next;
    }
}

String.prototype.hiraganaToKatakana = function () {
    // u3014:ぁ - u3093:ん
    // u30A1:ァ - u30F3:ン
    return this.replace(/[\u3041-\u3093]/g, (match) => {
        const code = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(code);
    }).replace("ウ゛", "ヴ");
};
