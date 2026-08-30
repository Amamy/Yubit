// state.js

export const Steps = Object.freeze({
    Init: 0,      // セッション開始前
    Ready: 1,     // セッション開始後
    Writing: 2,   // 回答入力中
    Submitted: 3, // 回答送信後
    Evaluation: 4 // 評価表示中
});

/**
 * 学習セッションの状態を保持するクラス。
 * DOM を一切参照せず、変更は EventTarget のイベントとして通知する。
 */
export class GameState extends EventTarget {
    sessionStartedAt = Date.now();

    #allWords = [];
    #currentWords = null;
    #step = undefined;
    #reviewCount = 0;
    #correctCount = 0;
    #incorrectCount = 0;
    #answeredCharacterCount = 0;
    #answeredWords = new Set();

    get allWords() {
        return this.#allWords;
    }

    set allWords(newWords) {
        this.#allWords = newWords;
    }

    get currentWords() {
        return this.#currentWords;
    }

    set currentWords(newWords) {
        this.#currentWords = newWords;
        this.#currentWords.onChange((items) => {
            this.dispatchEvent(new CustomEvent('currentwordschange', { detail: { items } }));
        });
    }

    get currentWord() {
        if (!this.currentWords || this.currentWords.length === 0) {
            return null;
        }
        return this.currentWords.peek();
    }

    get step() {
        return this.#step;
    }

    set step(newStep) {
        this.#step = newStep;
        this.dispatchEvent(new CustomEvent('stepchange', { detail: { step: newStep } }));
    }

    get reviewCount() {
        return this.#reviewCount;
    }

    incrementReviewCount() {
        this.#reviewCount++;
        this.dispatchEvent(new CustomEvent('reviewcountchange', { detail: { reviewCount: this.#reviewCount } }));
    }

    get correctCount() {
        return this.#correctCount;
    }

    get incorrectCount() {
        return this.#incorrectCount;
    }

    get totalAttempts() {
        return this.#correctCount + this.#incorrectCount;
    }

    incrementCorrectCount() {
        this.#correctCount++;
        this.dispatchEvent(new CustomEvent('scorechange', {
            detail: { correctCount: this.#correctCount, totalAttempts: this.totalAttempts }
        }));
    }

    incrementIncorrectCount() {
        this.#incorrectCount++;
        this.dispatchEvent(new CustomEvent('scorechange', {
            detail: { correctCount: this.#correctCount, totalAttempts: this.totalAttempts }
        }));
    }

    get answeredCharacterCount() {
        return this.#answeredCharacterCount;
    }

    addAnsweredCharacters(count) {
        this.#answeredCharacterCount += count;
    }

    get answeredWords() {
        return this.#answeredWords;
    }

    clearAnsweredWords() {
        this.#answeredWords.clear();
    }

    /**
     * 正解数・不正解数・見直し回数などをセッション開始時の状態に戻す
     */
    resetCounters() {
        this.#correctCount = 0;
        this.#incorrectCount = 0;
        this.#reviewCount = 0;
        this.#answeredCharacterCount = 0;
        this.sessionStartedAt = Date.now();
        this.dispatchEvent(new CustomEvent('scorechange', {
            detail: { correctCount: this.#correctCount, totalAttempts: this.totalAttempts }
        }));
    }
}
