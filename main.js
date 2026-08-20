// main.js

const MODEL_PATH = 'yubit.glb'; // モデルファイルのパス
const WORD_LIST_PATH = 'wordlist.json'; // 単語リストのJSONファイルのパス

import { Player } from './player.js';

const Steps = Object.freeze({
    Init: 0, // 回答未入力
    Writing: 1, // 回答入力中
    Submitted: 2 // 回答送信後
});

const state = {
    sessionStartedAt: Date.now(),

    _allWords: [],

    get allWords() {
        return this._allWords;
    },

    set allWords(newWords) {
        this._allWords = newWords;
    },

    _currentWords: [],

    get currentWords() {
        return this._currentWords;
    },

    set currentWords(newWords) {
        this._currentWords = newWords;
        // 単語リストが更新された場合の処理を実行
        this.onWordListChanged();
    },

    onWordListChanged() {
        console.log(`単語リストが更新されました (${this._currentWords.length} 件)`);
        // 必要に応じてUIの更新などを行う
    },

    _index: -1,

    get currentWordIndex() {
        return this._index;
    },

    set currentWordIndex(newIndex) {
        this._index = newIndex;
        // 更新時の処理を実行
        this.onWordIndexChanged();
    },

    onWordIndexChanged() {
        console.log(`単語番号が ${this._index} に変更されました`);

        const remainingWords = document.querySelector('.remaining-words');
        if (remainingWords) {
            remainingWords.textContent = (state.currentWords.length > 0) ? `${state.currentWordIndex + 1} / ${state.currentWords.length}` : '0 / 0';
        }
    },

    get currentWord() {
        if (this._index < 0 || this._index >= this._currentWords.length) {
            return undefined;
        } else {
            return this._currentWords[this._index];
        }
    },

    _step: 0, // 初期状態でSteps.Initとする

    get step() {
        return this._step;
    },

    set step(newStep) {
        this._step = newStep;
        if (this._step === Steps.Init) {
            this.onStepInit();
        }
    },

    onStepInit() {
        const answerInput = document.querySelector('.answer-input');
        if (answerInput) {
            answerInput.value = ''; // 入力欄をクリアする
            answerInput.classList.remove('correct', 'incorrect'); // 正誤表示をリセットする
        }

        const subtitleText = document.querySelector('.subtitle-text');
        if (subtitleText) {
            subtitleText.textContent = ''; // 字幕をクリアする
            subtitleText.classList.remove('correct', 'incorrect'); // 正誤表示をリセットする
        }
    },

    _reviewCount: 0, // 見直し回数のカウント

    get reviewCount() {
        return this._reviewCount;
    },

    incrementReviewCount() {
        this._reviewCount++;
    },

    _correctCount: 0, // 正解数のカウント

    get correctCount() {
        return this._correctCount;
    },

    incrementCorrectCount() {
        this._correctCount++;
        const accuracyRateDisplay = document.querySelector('.accuracy-rate');
        if (accuracyRateDisplay) {
            const totalAttempts = this._correctCount + this._incorrectCount;
            accuracyRateDisplay.textContent = `${this._correctCount} / ${totalAttempts}`;
        }
    },

    _incorrectCount: 0, // 不正解数のカウント

    get incorrectCount() {
        return this._incorrectCount;
    },

    incrementIncorrectCount() {
        this._incorrectCount++;
        const accuracyRateDisplay = document.querySelector('.accuracy-rate');
        if (accuracyRateDisplay) {
            const totalAttempts = this._correctCount + this._incorrectCount;
            accuracyRateDisplay.textContent = `${this._correctCount} / ${totalAttempts}`;
        }
    },

    _answeredCharacterCount: 0,

    get answeredCharacterCount() {
        return this._answeredCharacterCount;
    },

    addAnsweredCharacters(count) {
        this._answeredCharacterCount += count;
    },

    get activeDialog() {
        const dialogs = document.querySelectorAll('.dialog');
        for (const dialog of dialogs) {
            if (!dialog.hidden) {
                return dialog;
            }
        }
        return null;
    }
};

const canvas = document.querySelector('.player');
let playerInstance;
if (canvas) {
    playerInstance = new Player(canvas).load(MODEL_PATH);
    playerInstance.run();
}

// setup event listeners for buttons
document.addEventListener('DOMContentLoaded', async (event) => {
    // 設定の読み込み(LocalStorageから)
    const settings = JSON.parse(localStorage.getItem('settings')) || {};

    // 全体のキーイベントリスナー
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            state.activeDialog?.querySelector('.close-button')?.click();
        }
    });

    // 全体のマウスイベントリスナー
    document.addEventListener('mousedown', (event) => {
        const visiblePanel = state.activeDialog?.querySelector('.panel');
        if (visiblePanel && !visiblePanel.contains(event.target)) {
            visiblePanel.querySelector('.close-button')?.click();
        }
    });

    // プレイヤー
    const playerCanvas = document.querySelector('.player');
    if (playerCanvas) {
        playerCanvas.addEventListener('dblclick', () => {
            playerInstance.resetCamera();
        });
    }

    // 回答入力欄
    const answerInput = document.querySelector('.answer-input');
    if (answerInput) {
        let isComposing = false;
        answerInput.addEventListener('compositionstart', (event) => {
            isComposing = true;
        });
        answerInput.addEventListener('compositionend', (event) => {
            setTimeout(() => {
                isComposing = false;
            }, 0);
        });
        answerInput.addEventListener('keydown', (event) => {
            if (isComposing || event.isComposing || event.keyCode == 229) {
                return;
            }

            if (event.key === 'Enter') {
                submitAnswer();
            }

            // テスト用(Tabキーで回答欄の内容をキューに追加する)
            if (event.key === 'Tab') {
                playerInstance.enqueue(answerInput.value);
                event.preventDefault(); // デフォルトのタブ動作を無効化
            }
        });
        answerInput.addEventListener('input', (event) => {
            state.step = (answerInput.value.length == 0) ? Steps.Init : Steps.Writing;
        });

        answerInput.focus(); // 初期フォーカスを設定する
        answerInput.addEventListener('blur', (event) => {
            if (!state.activeDialog) {
                answerInput.focus(); // フォーカスを維持する
            }
        });
    }

    // 回答ボタン
    const answerButton = document.querySelector('.answer-button');
    if (answerButton) {
        answerButton.addEventListener('click', () => {
            submitAnswer();
        });
    }

    // リセットボタン
    const resetButton = document.querySelector('.reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            reset();
        });
    }

    // 学習履歴ダイアログ、学習履歴ボタン、学習履歴ダイアログの閉じるボタン
    const historyDialog = document.querySelector('.history-dialog');
    const historyButton = document.querySelector('.history-button');
    const historyCloseButton = document.querySelector('.history-close-button');
    if (historyDialog && historyButton && historyCloseButton) {
        historyButton.addEventListener('click', () => {
            renderLearningHistory();
            historyDialog.hidden = false;
            historyCloseButton.focus();
        });
        historyCloseButton.addEventListener('click', () => {
            historyDialog.hidden = true;
            setTimeout(() => {
                document.querySelector('.answer-input')?.focus();
            }, 0);
        });
    }

    // 見直しボタン
    const reviewButton = document.querySelector('.review-button');
    if (reviewButton) {
        reviewButton.addEventListener('click', () => {
            review();
        });
    }

    // 左右反転ボタン
    const flipButton = document.querySelector('.flip-mode');
    if (flipButton) {
        flipButton.addEventListener('click', () => {
            playerInstance.toggleFlipMode();
            saveSettings();
        });
        if (settings.flipMode == true) {
            flipButton.checked = true;
            flipButton.dispatchEvent(new Event('click')); // 初期状態を反映するためにイベントを発火
        }
    }

    // １文字モード
    const singleCharModeCheckbox = document.querySelector('.single-char-mode');
    if (singleCharModeCheckbox) {
        singleCharModeCheckbox.addEventListener('change', () => {
            console.log(`1文字モードが${singleCharModeCheckbox.checked ? '有効' : '無効'}になりました`);
            if (singleCharModeCheckbox.checked) {
                // state.currentWords = filterWordsByLength(state.allWords, 1, 1);
                if (minLengthInput) minLengthInput.disabled = true;
                if (maxLengthInput) maxLengthInput.disabled = true;
            } else {
                const minLength = parseInt(minLengthInput.value, 10);
                const maxLength = parseInt(maxLengthInput.value, 10);
                // state.currentWords = filterWordsByLength(state.allWords, minLength, maxLength);
                if (minLengthInput) minLengthInput.disabled = false;
                if (maxLengthInput) maxLengthInput.disabled = false;
            }
            // reset();
            saveSettings();
        });
        if (settings.singleCharMode == true) {
            singleCharModeCheckbox.checked = true;
            singleCharModeCheckbox.dispatchEvent(new Event('change')); // 初期状態を反映するためにイベントを発火
        }
    }

    // 文字数(最小/最大)
    const minLengthInput = document.querySelector('.word-length-min');
    const maxLengthInput = document.querySelector('.word-length-max');
    if (minLengthInput && maxLengthInput) {
        const handler = function (e) {
            const minLength = parseInt(minLengthInput.value, 10);
            const maxLength = parseInt(maxLengthInput.value, 10);
            if (e.target == minLengthInput && minLength > maxLength) {
                maxLengthInput.value = minLength; // 最大値を最小値に合わせる
            }
            if (e.target == maxLengthInput && maxLength < minLength) {
                minLengthInput.value = maxLength; // 最小値を最大値に合わせる
            }
            if (!isNaN(minLength) && !isNaN(maxLength)) {
                console.log(`文字数の範囲が設定されました: ${minLength} - ${maxLength}`);
                // state.currentWords = filterWordsByLength(state.allWords, minLength, maxLength);
                // reset();
                saveSettings();
            } else {
                console.error('無効な文字数の範囲です。');
            }
        };
        minLengthInput.addEventListener('change', handler);
        maxLengthInput.addEventListener('change', handler);

        if (settings.wordLengthMin && minLengthInput.disabled === false) {
            minLengthInput.value = settings.wordLengthMin;
        }
        if (settings.wordLengthMax && maxLengthInput.disabled === false) {
            maxLengthInput.value = settings.wordLengthMax;
        }
    }

    // 速度調整
    const playSpeedSelector = document.querySelector('.play-speed');
    if (playSpeedSelector) {
        playSpeedSelector.addEventListener('change', () => {
            console.log(`再生速度が変更されました: ${playSpeedSelector.value}`);
            playerInstance.setPlaySpeed(parseFloat(playSpeedSelector.value));
            saveSettings();
        });
        if (settings.playSpeed) {
            playSpeedSelector.value = settings.playSpeed;
            playSpeedSelector.dispatchEvent(new Event('change')); // 初期状態を反映するためにイベントを発火
        }
    }

    // 間の調整
    const playIntervalSelector = document.querySelector('.play-interval');
    if (playIntervalSelector) {
        playIntervalSelector.addEventListener('change', () => {
            const intervalValue = parseFloat(playIntervalSelector.value);
            console.log(`文字間のインターバルが変更されました: ${intervalValue}秒`);
            playerInstance.setInterval(intervalValue);
            saveSettings();
        });
        if (settings.playInterval) {
            playIntervalSelector.value = settings.playInterval;
            playIntervalSelector.dispatchEvent(new Event('change')); // 初期状態を反映するためにイベントを発火
        }
    }

    // 正答率
    const accuracyRateDisplay = document.querySelector('.accuracy-rate');
    if (accuracyRateDisplay) {
        accuracyRateDisplay.textContent = '0 / 0'; // 初期表示
    }

    // 終了ボタン
    const endButton = document.querySelector('.end-button');
    if (endButton) {
        endButton.addEventListener('click', () => {
            finishSession();
        });
    }

    // 評価ダイアログ、評価ダイアログの閉じるボタン
    const evaluationDialog = document.querySelector('.evaluation-dialog');
    const evaluationCloseButton = document.querySelector('.evaluation-close-button');
    if (evaluationDialog && evaluationCloseButton) {
        evaluationCloseButton.addEventListener('click', () => {
            evaluationDialog.hidden = true;
            reset();
            document.querySelector('.answer-input')?.focus();
        });
    }

    // 単語リストの読み込み
    await loadWordList();

    // 単語リストのフィルタリング
    if (minLengthInput && maxLengthInput) {
        const minLength = parseInt(minLengthInput.value, 10);
        const maxLength = parseInt(maxLengthInput.value, 10);
        state.currentWords = filterWordsByLength(state.allWords, minLength, maxLength);
        state.currentWordIndex = 0;
    }
});

playerInstance.addEventListener('loadingFinished', () => {
    playerInstance.restPose();
});

// Load the word list from a JSON file
async function loadWordList() {
    try {
        const response = await fetch(WORD_LIST_PATH);
        const data = await response.json();
        if (Array.isArray(data.words)) {
            state.allWords.length = 0; // Clear the existing list
            state.allWords.push(...data.words); // Populate with new words
            state.allWords.shuffle(); // Shuffle the word list
        } else {
            console.error('Invalid word list format in JSON.');
        }
    } catch (error) {
        console.error('Error loading word list:', error);
    }
}

Array.prototype.shuffle = function () {
    for (let i = this.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this[i], this[j]] = [this[j], this[i]];
    }
    return this;
};

function filterWordsByLength(words, minLength, maxLength) {
    return words.filter(word => word.length >= minLength && word.length <= maxLength);
}

function submitAnswer() {
    const answerInput = document.querySelector('.answer-input');
    const subtitleText = document.querySelector('.subtitle-text');
    console.log(`submitAnswer called. Current step: ${state.step}, Current word: ${state.currentWord}`);
    if (answerInput) {
        switch (state.step) {
            case Steps.Init:
                // 回答未入力の場合、見直し処理とする
                review();
                break;
            case Steps.Writing:
                const inputWord = answerInput.value.trim().hiraganaToKatakana();

                if (inputWord === '' || state.currentWord === undefined) {
                    return; // 空の回答は無視
                }

                state.addAnsweredCharacters(state.currentWord.length);

                // 正誤判定
                if (inputWord == state.currentWord) {
                    answerInput.classList.add('correct');
                    if (subtitleText) {
                        subtitleText.classList.add('correct');
                    }
                    state.incrementCorrectCount(); // 正解数を増やす
                } else {
                    answerInput.classList.add('incorrect');
                    if (subtitleText) {
                        subtitleText.classList.add('incorrect');
                    }
                    state.incrementIncorrectCount(); // 不正解数を増やす
                }

                // 正しい答えを表示する
                if (subtitleText) {
                    subtitleText.textContent = state.currentWord;
                }

                // ステップを進める
                state.step = Steps.Submitted;
                break;
            case Steps.Submitted:
                // 次の単語を再生するためにキューに追加
                if (state.currentWordIndex >= state.currentWords.length - 1) {
                    console.log('すべての単語を回答しました。セッションを終了します。');
                    finishSession(); // セッションを終了する
                    return;
                } else {
                    state.currentWordIndex++; // 次の単語に進む
                    playerInstance.enqueue(state.currentWords[state.currentWordIndex]);
                }

                state.step = Steps.Init; // ステップを初期化
                break;
        }
    }
}

function review() {
    if (state.currentWords.length == 0) {
        return;
    }

    // 見直し処理
    state.incrementReviewCount(); // 見直し回数を増やす
    playerInstance.enqueue(state.currentWords[state.currentWordIndex]); // 現在の単語を再生するためにキューに追加
}

function reset() {
    state.currentWords.shuffle(); // 単語リストをシャッフルする
    state.currentWordIndex = 0; // インデックスをリセットする
    state.step = Steps.Init; // ステップを初期化する
    state._correctCount = 0;
    state._incorrectCount = 0;
    state._reviewCount = 0;
    state._answeredCharacterCount = 0;
    state.sessionStartedAt = Date.now();
    const accuracyRateDisplay = document.querySelector('.accuracy-rate');
    if (accuracyRateDisplay) {
        accuracyRateDisplay.textContent = '0 / 0';
    }
    playerInstance.resetCamera(); // カメラをリセットする
    playerInstance.restPose();
}

function finishSession() {
    const totalAttempts = state.correctCount + state.incorrectCount;
    const accuracyRate = totalAttempts > 0 ? (state.correctCount / totalAttempts) * 100 : 0;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.sessionStartedAt) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const characters = state.answeredCharacterCount;
    const secondsPerCharacter = characters > 0 ? (elapsedSeconds / characters) : 0;
    const grade = getGrade(accuracyRate);

    document.querySelector('.evaluation-answered-words').textContent = totalAttempts;
    document.querySelector('.evaluation-correct-words').textContent = state.correctCount;
    document.querySelector('.evaluation-accuracy').textContent = `${accuracyRate.toFixed(2)}%`;
    document.querySelector('.evaluation-duration').textContent = `${minutes}分${String(seconds).padStart(2, '0')}秒`;
    document.querySelector('.evaluation-characters').textContent = `${characters}字`;
    document.querySelector('.evaluation-time-per-character').textContent = `${secondsPerCharacter.toFixed(1)}秒`;
    document.querySelector('.evaluation-reviews').textContent = `${state.reviewCount}回`;
    document.querySelector('.evaluation-grade-value').textContent = grade;

    const evaluationDialog = document.querySelector('.evaluation-dialog');
    if (evaluationDialog) {
        evaluationDialog.hidden = false;
        setTimeout(() => {
            document.querySelector('.evaluation-close-button')?.focus();
        }, 0);
    }

    // LocalStorageに結果を保存する
    const sessionResult = {
        ts: new Date().toISOString(), // 日時
        n_words: totalAttempts, // 単語数
        n_correct: state.correctCount, // 正解数
        n_chars: characters, // 文字数
        n_reviews: state.reviewCount, // 見直し回数
        n_seconds: elapsedSeconds, // 学習時間(秒)
    };

    let sessionResults = JSON.parse(localStorage.getItem('sessionResults')) || [];
    sessionResults.push(sessionResult);
    localStorage.setItem('sessionResults', JSON.stringify(sessionResults));
}

function renderLearningHistory() {
    let sessionResults = [];
    try {
        const storedResults = JSON.parse(localStorage.getItem('sessionResults') || '[]');
        if (Array.isArray(storedResults)) {
            sessionResults = storedResults.filter(result => result && typeof result === 'object');
        }
    } catch (error) {
        console.error('学習履歴の読み込みに失敗しました:', error);
    }

    const total = (key) => sessionResults.reduce((sum, result) => sum + (Number(result[key]) || 0), 0);
    const sessions = sessionResults.length;
    const words = total('n_words');
    const correct = total('n_correct');
    const seconds = total('n_seconds');
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    document.querySelector('.history-sessions').textContent = `${sessions}回`;
    document.querySelector('.history-words').textContent = `${words}個`;
    document.querySelector('.history-accuracy').textContent = `${(words > 0 ? (correct / words) * 100 : 0).toFixed(2)}%`;
    document.querySelector('.history-duration').textContent = `${hours}時間${String(remainingMinutes).padStart(2, '0')}分${String(remainingSeconds).padStart(2, '0')}秒`;
    document.querySelector('.history-characters').textContent = `${total('n_chars')}字`;
    document.querySelector('.history-reviews').textContent = `${total('n_reviews')}回`;
    document.querySelector('.history-empty').hidden = sessions > 0;
}

function getGrade(accuracyRate) {
    if (accuracyRate >= 90) return '達人';
    if (accuracyRate >= 75) return '上級';
    if (accuracyRate >= 50) return '中級';
    return '初級';
}

function saveSettings() {
    const settings = {
        wordLengthMin: document.querySelector('.word-length-min')?.value || '',
        wordLengthMax: document.querySelector('.word-length-max')?.value || '',
        singleCharMode: document.querySelector('.single-char-mode')?.checked || false,
        playSpeed: document.querySelector('.play-speed')?.value || '1.0',
        playInterval: document.querySelector('.play-interval')?.value || '0',
        flipMode: document.querySelector('.flip-mode')?.checked || false
    };

    localStorage.setItem('settings', JSON.stringify(settings));
}
