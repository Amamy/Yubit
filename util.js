// util.js

/**
 * 指定されたミリ秒だけ待機する
 * @param {number} ms - 待機するミリ秒数
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function assert(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Assertion failed: expected ${expected}, but got ${actual}`);
    }
}

export function assertTrue(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed: condition is not true');
    }
}

/**
 * 拡張メソッドをインストールする
 */
export function installExtensions() {

    /**
     * ひらがなをカタカナに変換する
     * @returns {string} - カタカナに変換された文字列
     */
    String.prototype.hiraganaToKatakana = function () {
        // u3014:ぁ - u3093:ん
        // u30A1:ァ - u30F3:ン
        return this.replace(/[\u3041-\u3093]/g, (match) => {
            const code = match.charCodeAt(0) + 0x60;
            return String.fromCharCode(code);
        }).replace("ウ゛", "ヴ");
    };

}

/**
 * 変更を監視できる配列クラス
 */
export class ObservableArray {
    #items = [];
    #listeners = [];

    constructor(initialItems = []) {
        this.#items = [...initialItems];
    }

    onChange(callback) {
        this.#listeners.push(callback);
    }

    #notify() {
        this.#listeners.forEach(listener => listener(this.#items));
    }

    push(item) {
        this.#items.push(item);
        this.#notify();
    }

    pop() {
        const item = this.#items.pop();
        this.#notify();
        return item;
    }

    peek() {
        if (this.#items.length === 0) {
            return undefined;
        }
        return this.#items[this.#items.length - 1];
    }

    shuffle() {
        for (let i = this.#items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.#items[i], this.#items[j]] = [this.#items[j], this.#items[i]];
        }
        this.#notify();
    }

    get items() {
        return [...this.#items];
    }

    get length() {
        return this.#items.length;
    }
}