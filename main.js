// main.js

const MODEL_PATH = 'yubit.glb'; // モデルファイルのパス
const WORD_LIST_PATH = 'wordlist.json'; // 単語リストのJSONファイルのパス

import { assertTrue, installExtensions, ObservableArray } from './util.js';
import { Player } from './player.js';
import { GameState, Steps } from './state.js';

installExtensions();

const playerInstance = new Player();
const state = new GameState();

// DOM要素は動的に追加・削除されないため、起動時に一度だけ取得してキャッシュする
const elements = {};

function cacheElements() {
    elements.canvas = document.querySelector('.player');
    elements.dialogs = document.querySelectorAll('.dialog');
    elements.remainingWords = document.querySelector('.remaining-words');
    elements.accuracyRateDisplay = document.querySelector('.accuracy-rate');
    elements.greyOverlay = document.querySelector('.grey-overlay');
    elements.answerInput = document.querySelector('.answer-input');
    elements.reviewButton = document.querySelector('.review-button');
    elements.subtitleText = document.querySelector('.subtitle-text');
    elements.answerButton = document.querySelector('.answer-button');
    elements.resetButton = document.querySelector('.reset-button');
    elements.historyDialog = document.querySelector('.history-dialog');
    elements.historyButton = document.querySelector('.history-button');
    elements.historyCloseButton = document.querySelector('.history-close-button');
    elements.flipButton = document.querySelector('.flip-mode');
    elements.minLengthInput = document.querySelector('.word-length-min');
    elements.maxLengthInput = document.querySelector('.word-length-max');
    elements.playSpeedSelector = document.querySelector('.play-speed');
    elements.playIntervalSelector = document.querySelector('.play-interval');
    elements.endButton = document.querySelector('.end-button');
    elements.evaluationDialog = document.querySelector('.evaluation-dialog');
    elements.evaluationCloseButton = document.querySelector('.evaluation-close-button');
    elements.evaluationAnsweredWords = document.querySelector('.evaluation-answered-words');
    elements.evaluationCorrectWords = document.querySelector('.evaluation-correct-words');
    elements.evaluationAccuracy = document.querySelector('.evaluation-accuracy');
    elements.evaluationDuration = document.querySelector('.evaluation-duration');
    elements.evaluationCharacters = document.querySelector('.evaluation-characters');
    elements.evaluationTimePerCharacter = document.querySelector('.evaluation-time-per-character');
    elements.evaluationReviews = document.querySelector('.evaluation-reviews');
    elements.evaluationGradeValue = document.querySelector('.evaluation-grade-value');
    elements.historySessions = document.querySelector('.history-sessions');
    elements.historyWords = document.querySelector('.history-words');
    elements.historyAccuracy = document.querySelector('.history-accuracy');
    elements.historyDuration = document.querySelector('.history-duration');
    elements.historyCharacters = document.querySelector('.history-characters');
    elements.historyReviews = document.querySelector('.history-reviews');
    elements.historyEmpty = document.querySelector('.history-empty');

    // 簡易テスト
    for (const [key, value] of Object.entries(elements)) {
        assertTrue(value !== null, `DOM要素が見つかりません: ${key}`);
    }
}

// ダイアログの表示状態は DOM に紐づくため main.js 側で解決する
function getActiveDialog() {
    for (const dialog of elements.dialogs) {
        if (!dialog.hidden) {
            return dialog;
        }
    }
    return null;
}

state.addEventListener('currentwordschange', (event) => {
    elements.remainingWords.textContent = event.detail.items.length;
});

state.addEventListener('scorechange', (event) => {
    elements.accuracyRateDisplay.textContent = `${event.detail.correctCount} / ${event.detail.totalAttempts}`;
});

state.addEventListener('stepchange', (event) => {
    onStepChanged(event.detail.step);
});

function onStepChanged(step) {
    const { greyOverlay, answerInput, reviewButton, subtitleText } = elements;
    switch (step) {
        case Steps.Init:
            greyOverlay.hidden = false;
            answerInput.placeholder = 'Enterでスタート'
            answerInput.value = ''; // 入力欄をクリアする
            answerInput.classList.remove('correct', 'incorrect'); // 正誤表示をリセットする
            reviewButton.textContent = 'スタート';

            subtitleText.textContent = ''; // 字幕をクリアする
            subtitleText.classList.remove('correct', 'incorrect'); // 正誤表示をリセットする
            break;
        case Steps.Ready:
            greyOverlay.hidden = true; // グレーのオーバーレイを非表示にする
            answerInput.placeholder = 'Enterで見直し／回答'
            reviewButton.textContent = 'もう一度再生する';
            answerInput.value = ''; // 入力欄をクリアする
            answerInput.classList.remove('correct', 'incorrect'); // 正誤表示をリセットする
            subtitleText.textContent = ''; // 字幕をクリアする
            subtitleText.classList.remove('correct', 'incorrect'); // 正誤表示をリセットする
            break;
        case Steps.Writing:
            break;
        case Steps.Submitted:
            break;
        case Steps.Evaluation:
            break;
        default:
            console.error(`Unknown step: ${step}`);
    }
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('settings'))
    const defaultSettings = {
        wordLengthMin: '2',
        wordLengthMax: '5',
        playSpeed: '1.0',
        playInterval: '0',
        flipMode: false
    };

    if (!settings) {
        return defaultSettings;
    }

    try {
        const min = parseInt(settings.wordLengthMin);
        const max = parseInt(settings.wordLengthMax);
        const speed = parseFloat(settings.playSpeed);
        const interval = parseFloat(settings.playInterval);

        if ([min, max, speed, interval].some(Number.isNaN)) {
            console.warn('Invalid settings in LocalStorage, falling back to defaults:', settings);
            return defaultSettings;
        }
    } catch (error) {
        console.error('Error loading settings from LocalStorage:', settings, error);
        return defaultSettings;
    }

    console.debug('Loaded settings from LocalStorage:', settings);

    return settings;
}


// setup event listeners for buttons
function setupListeners() {

    // 設定の読み込み(LocalStorageから)
    const settings = loadSettings();

    // 全体のキーイベントリスナー
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            getActiveDialog()?.querySelector('.close-button')?.click();
        }
    });

    // 全体のマウスイベントリスナー
    document.addEventListener('mousedown', (event) => {
        const visiblePanel = getActiveDialog()?.querySelector('.panel');
        if (visiblePanel && !visiblePanel.contains(event.target)) {
            visiblePanel.querySelector('.close-button')?.click();
        }
    });

    // プレイヤー
    elements.canvas.addEventListener('dblclick', () => {
        playerInstance.resetCamera();
    });

    // 回答入力欄
    const answerInput = elements.answerInput;
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

        switch (event.key) {
            case 'Enter':
                switch (state.step) {
                    case Steps.Init:
                        state.step = Steps.Ready;
                        review(false);
                        break;
                    case Steps.Ready:
                        review(true);
                        break;
                    case Steps.Writing:
                    case Steps.Submitted:
                        submitAnswer();
                        break;
                }
                event.preventDefault(); // デフォルトのEnter動作を無効化
                break;
            case 'Tab':
                // テスト用(Tabキーで回答欄の内容をキューに追加する)
                if (answerInput.value.length > 0) {
                    playerInstance.enqueue(answerInput.value);
                    event.preventDefault(); // デフォルトのタブ動作を無効化
                }
                break;
            default:
                break;
        }
    });
    answerInput.addEventListener('input', (event) => {
        if (answerInput.value.length > 0) {
            state.step = Steps.Writing;
        } else {
            state.step = Steps.Ready;
        }
    });

    answerInput.value = '';
    answerInput.focus(); // 初期フォーカスを設定する
    answerInput.addEventListener('blur', (event) => {
        if (!getActiveDialog()) {
            answerInput.focus(); // フォーカスを維持する
        }
    });

    // 回答ボタン
    elements.answerButton.addEventListener('click', () => {
        submitAnswer();
    });

    // リセットボタン
    elements.resetButton.addEventListener('click', () => {
        reset();
    });

    // 学習履歴ダイアログ、学習履歴ボタン、学習履歴ダイアログの閉じるボタン
    const historyDialog = elements.historyDialog;
    elements.historyButton.addEventListener('click', () => {
        renderLearningHistory();
        historyDialog.hidden = false;
        elements.historyCloseButton.focus();
    });
    elements.historyCloseButton.addEventListener('click', () => {
        historyDialog.hidden = true;
        setTimeout(() => {
            elements.answerInput.focus();
        }, 0);
    });

    // 見直しボタン
    elements.reviewButton.addEventListener('click', () => {
        if (state.step === Steps.Init) {
            state.step = Steps.Ready;
            review(false);
        } else {
            review(true);
        }
    });

    // 左右反転ボタン
    const flipButton = elements.flipButton;
    flipButton.addEventListener('click', () => {
        playerInstance.setFlipMode(flipButton.checked);
        saveSettings();
    });
    if (settings.flipMode !== undefined) {
        flipButton.checked = settings.flipMode;
        playerInstance.setFlipMode(flipButton.checked);
    }

    // 文字数(最小/最大)
    const minLengthInput = elements.minLengthInput;
    const maxLengthInput = elements.maxLengthInput;
    const lengthChangeHandler = function (e) {
        let minLength = parseInt(minLengthInput.value, 10);
        let maxLength = parseInt(maxLengthInput.value, 10);
        if (e.target == minLengthInput && minLength > maxLength) {
            maxLengthInput.value = minLength; // 最大値を最小値に合わせる
            maxLength = minLength;
        }
        if (e.target == maxLengthInput && maxLength < minLength) {
            minLengthInput.value = maxLength; // 最小値を最大値に合わせる
            minLength = maxLength;
        }
        if (!isNaN(minLength) && !isNaN(maxLength)) {
            const temp = filterWordsByLength(state.allWords, minLength, maxLength);
            state.currentWords = new ObservableArray(filterAnsweredWords(temp));
            state.currentWords.shuffle();
            saveSettings();
        } else {
            console.error('無効な文字数の範囲です。');
        }
    };
    minLengthInput.addEventListener('change', lengthChangeHandler);
    maxLengthInput.addEventListener('change', lengthChangeHandler);

    if (settings.wordLengthMin && minLengthInput.disabled === false) {
        minLengthInput.value = settings.wordLengthMin;
    }
    if (settings.wordLengthMax && maxLengthInput.disabled === false) {
        maxLengthInput.value = settings.wordLengthMax;
    }

    // 速度調整
    const playSpeedSelector = elements.playSpeedSelector;
    playSpeedSelector.addEventListener('change', () => {
        playerInstance.setPlaySpeed(parseFloat(playSpeedSelector.value));
        saveSettings();
    });
    if (settings.playSpeed !== undefined) {
        playSpeedSelector.value = settings.playSpeed;
        playerInstance.setPlaySpeed(parseFloat(playSpeedSelector.value));
    }

    // 間の調整
    const playIntervalSelector = elements.playIntervalSelector;
    playIntervalSelector.addEventListener('change', () => {
        const intervalValue = parseFloat(playIntervalSelector.value);
        playerInstance.setInterval(intervalValue);
        saveSettings();
    });
    if (settings.playInterval !== undefined) {
        playIntervalSelector.value = settings.playInterval;
        playerInstance.setInterval(parseFloat(playIntervalSelector.value));
    }

    // 正答率
    elements.accuracyRateDisplay.textContent = '0 / 0'; // 初期表示

    // 終了ボタン
    elements.endButton.addEventListener('click', () => {
        state.step = Steps.Evaluation;
        finishSession();
    });

    // 評価ダイアログ、評価ダイアログの閉じるボタン
    const evaluationDialog = elements.evaluationDialog;
    elements.evaluationCloseButton.addEventListener('click', () => {
        evaluationDialog.hidden = true;
        reset();
        elements.answerInput.focus();
    });

    // 単語リストのフィルタリング
    const initialMinLength = parseInt(minLengthInput.value, 10);
    const initialMaxLength = parseInt(maxLengthInput.value, 10);
    state.currentWords = new ObservableArray(filterWordsByLength(state.allWords, initialMinLength, initialMaxLength));
    state.currentWords.shuffle();
}

// Load the word list from a JSON file
async function loadWordList() {
    try {
        const response = await fetch(WORD_LIST_PATH);
        const data = await response.json();
        if (Array.isArray(data.words)) {
            state.allWords.length = 0; // Clear the existing list
            state.allWords.push(...data.words); // Populate with new words
            console.debug(`Loaded ${state.allWords.length} words from ${WORD_LIST_PATH}`);
        } else {
            console.error('Invalid word list format in JSON.');
        }
    } catch (error) {
        console.error('Error loading word list:', error);
    }
}

function filterWordsByLength(words, minLength, maxLength) {
    return words.filter(word => word.length >= minLength && word.length <= maxLength);
}

function filterAnsweredWords(words) {
    return words.filter(word => !state.answeredWords.has(word));
}

function submitAnswer() {
    const { answerInput, subtitleText } = elements;
    switch (state.step) {
        case Steps.Writing:
            const inputWord = answerInput.value.trim().hiraganaToKatakana();

            if (inputWord === '' || state.currentWord === null) {
                return; // 空の回答は無視
            }

            state.addAnsweredCharacters(state.currentWord.length);
            state.answeredWords.add(state.currentWord); // 回答済みの単語をセットに追加

            // 正誤判定
            if (inputWord == state.currentWord) {
                answerInput.classList.add('correct');
                subtitleText.classList.add('correct');
                state.incrementCorrectCount(); // 正解数を増やす
            } else {
                answerInput.classList.add('incorrect');
                subtitleText.classList.add('incorrect');
                state.incrementIncorrectCount(); // 不正解数を増やす
            }

            // 正しい答えを表示する
            subtitleText.textContent = state.currentWord;

            // ステップを進める
            state.step = Steps.Submitted;
            break;
        case Steps.Submitted:
            playerInstance.clearQueue(); // キューをクリアする
            state.currentWords.pop(); // 回答済みの単語をリストから削除する

            // 次の単語を再生するためにキューに追加
            if (state.currentWords.length === 0) {
                state.step = Steps.Evaluation;
                finishSession(); // セッションを終了する
                return;
            } else {
                playerInstance.enqueue(state.currentWords.peek()); // 次の単語をキューに追加
            }

            state.step = Steps.Ready;
            break;
    }
}

function review(increment = true) {
    if (!state.currentWord) {
        return;
    }

    // 見直し処理
    if (increment) {
        state.incrementReviewCount(); // 見直し回数を増やす
    }
    playerInstance.clearQueue(); // キューをクリアする
    setTimeout(() => {
        playerInstance.enqueue(state.currentWord); // 現在の単語を再生するためにキューに追加
    }, 500);
}

function reset() {
    state.clearAnsweredWords(); // 回答済みの単語をリセットする
    refreshCurrentWords(); // 現在の単語リストを更新する
    state.step = Steps.Init; // ステップを初期化する
    state.resetCounters();
    playerInstance.clearQueue(); // キューをクリアする
    playerInstance.resetCamera(); // カメラをリセットする
    playerInstance.restPose();
}

function finishSession() {
    const totalAttempts = state.totalAttempts;
    const accuracyRate = totalAttempts > 0 ? (state.correctCount / totalAttempts) * 100 : 0;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.sessionStartedAt) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const characters = state.answeredCharacterCount;
    const secondsPerCharacter = characters > 0 ? (elapsedSeconds / characters) : 0;
    const grade = getGrade(accuracyRate);

    elements.evaluationAnsweredWords.textContent = totalAttempts;
    elements.evaluationCorrectWords.textContent = state.correctCount;
    elements.evaluationAccuracy.textContent = `${accuracyRate.toFixed(2)}%`;
    elements.evaluationDuration.textContent = `${minutes}分${String(seconds).padStart(2, '0')}秒`;
    elements.evaluationCharacters.textContent = `${characters}字`;
    elements.evaluationTimePerCharacter.textContent = `${secondsPerCharacter.toFixed(1)}秒`;
    elements.evaluationReviews.textContent = `${state.reviewCount}回`;
    elements.evaluationGradeValue.textContent = grade;

    elements.evaluationDialog.hidden = false;
    playerInstance.clearQueue(); // キューをクリアする

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

    state.clearAnsweredWords(); // 回答済みの単語をリセットする
    refreshCurrentWords(); // 現在の単語リストを更新する
}

function loadLearningHistory() {
    try {
        const storedResults = JSON.parse(localStorage.getItem('sessionResults') || '[]');
        if (Array.isArray(storedResults)) {
            return storedResults.filter(result => result && typeof result === 'object');
        }
    } catch (error) {
        console.error('学習履歴の読み込みに失敗しました:', error);
    }
    return [];
}

function renderLearningHistory() {
    const sessionResults = loadLearningHistory();

    const total = (key) => sessionResults.reduce((sum, result) => sum + (Number(result[key]) || 0), 0);
    const sessions = sessionResults.length;
    const words = total('n_words');
    const correct = total('n_correct');
    const seconds = total('n_seconds');
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    elements.historySessions.textContent = `${sessions}回`;
    elements.historyWords.textContent = `${words}個`;
    elements.historyAccuracy.textContent = `${(words > 0 ? (correct / words) * 100 : 0).toFixed(2)}%`;
    elements.historyDuration.textContent = `${hours}時間${String(remainingMinutes).padStart(2, '0')}分${String(remainingSeconds).padStart(2, '0')}秒`;
    elements.historyCharacters.textContent = `${total('n_chars')}字`;
    elements.historyReviews.textContent = `${total('n_reviews')}回`;
    elements.historyEmpty.hidden = sessions > 0;
}

function getGrade(accuracyRate) {
    if (accuracyRate >= 90) return '達人';
    if (accuracyRate >= 75) return '上級';
    if (accuracyRate >= 50) return '中級';
    return '初級';
}

function saveSettings() {
    const settings = {
        wordLengthMin: elements.minLengthInput.value || 2,
        wordLengthMax: elements.maxLengthInput.value || 5,
        playSpeed: elements.playSpeedSelector.value || 1.0,
        playInterval: elements.playIntervalSelector.value || 0,
        flipMode: elements.flipButton.checked || false
    };

    localStorage.setItem('settings', JSON.stringify(settings));
}

function refreshCurrentWords() {
    const minLength = elements.minLengthInput.value || 2;
    const maxLength = elements.maxLengthInput.value || 5;

    const temp = filterWordsByLength(state.allWords, minLength, maxLength);
    state.currentWords = new ObservableArray(filterAnsweredWords(temp));
    state.currentWords.shuffle();
}

function waitForDOMContentLoaded() {
    return new Promise((resolve) => {
        if (document.readyState !== 'loading') {
            console.debug('DOMContentLoaded event has already fired');
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                console.debug('DOMContentLoaded event fired');
                resolve();
            }, { once: true });
        }
    });
}

async function main() {
    await Promise.all([
        loadWordList(),
        playerInstance.loadAsync(MODEL_PATH),
        waitForDOMContentLoaded()
    ]);
    cacheElements();
    playerInstance.bind(elements.canvas);
    playerInstance.run();
    playerInstance.restPose();
    setupListeners();
}

main();
