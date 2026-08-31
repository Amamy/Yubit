// player.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sleep } from './util.js';

const TIME_CROSS_FADE = 0.25; // クロスフェードの時間（秒）
const SCALE_FACTOR = 1.25; // モデルのスケールを調整するための係数
const MIN_DURATION = 0.5; // 最小再生時間（秒）

export class Player extends EventTarget {
    constructor() {
        super();
        this.scene = new THREE.Scene();

        this.mixer = null;
        this.actions = new Map();
        this.actionsClone = new Map();

        this.queue = [];
        this.dakuonCount = 0;
        this.previousItem = null;
        this.isPlaying = false;
        this.speedFactor = 1.0;
        this.interval = 0;
    }

    bind(canvas) {
        this.camera = new THREE.PerspectiveCamera(25, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8; // 全体の明るさの微調整用
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.resetCamera();

        // set lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 3.14);
        directionalLight.position.set(6, 5, 4);
        this.scene.add(directionalLight);
    }

    loadAsync(path) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                path,
                (gltf) => {
                    // 読み込み成功時の処理
                    const model = gltf.scene;
                    model.scale.set(SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR); // モデルのスケールを調整（必要に応じて変更）
                    this.scene.add(model);

                    // アニメーションがある場合はミキサーを作成
                    this.mixer = new THREE.AnimationMixer(model);
                    console.debug("モデルの読み込みに成功　アニメーションの数:", gltf.animations.length);
                    gltf.animations.forEach((clip) => {
                        if (clip.name == '゛') {
                            const filteredTracks = clip.tracks.filter(track => {
                                return track.name.includes("root");
                            });
                            clip.tracks = filteredTracks;
                        }
                        if (clip.name == "SnapX-" || clip.name == "SnapX+") {
                            const filteredTracks = clip.tracks.filter(track => {
                                return track.name.includes("DEF-handR.quaternion");
                            });
                            filteredTracks.forEach(track => restrictToAxis(track, 'x'));
                            clip.tracks = filteredTracks;
                        }
                        if (clip.name == "SnapY") {
                            const filteredTracks = clip.tracks.filter(track => {
                                return track.name.includes("DEF-handR.quaternion");
                            });
                            filteredTracks.forEach(track => restrictToAxis(track, 'y'));
                            clip.tracks = filteredTracks;
                        }
                        if (clip.name == "SnapZ") {
                            const filteredTracks = clip.tracks.filter(track => {
                                return track.name.includes("DEF-handR.quaternion");
                            });
                            filteredTracks.forEach(track => restrictToAxis(track, 'z'));
                            clip.tracks = filteredTracks;
                        }
                        const action = this.mixer.clipAction(clip);
                        action.setLoop(THREE.LoopOnce, 1); // 1回だけ再生
                        action.clampWhenFinished = true; // 終了時に最後のフレームで止まる
                        this.actions.set(clip.name, action);
                        if (clip.duration < MIN_DURATION) {
                            setClipDuration(clip, MIN_DURATION);
                        }
                    });

                    this.mixer.addEventListener('finished', this.onFinished.bind(this));
                    resolve();
                },
                (progress) => {
                    console.debug('モデル読み込み中:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('モデル読み込みでエラーが発生しました:', error);
                    reject(error);
                }
            );
        });
    }

    run() {
        const clock = new THREE.Clock();

        const animate = () => {
            requestAnimationFrame(animate);

            if (this.mixer) {
                const delta = clock.getDelta();
                this.mixer.update(delta);
            }
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    onFinished(event) {
        console.debug(`アクションの完了 (${event.action.getClip().name}) at time ${Math.round(this.mixer.time * 1000) / 1000}:`, event);

        switch (event.action.getClip().name) {
            case 'SnapX+':
            case 'SnapX-':
            case 'SnapY':
            case 'SnapZ':
                return;
            default:
                break;
        }

        if (this.queue.length > 0) {
            this.resume();
        } else {
            this.isPlaying = false;
        }
    }

    async resume() {
        const item = this.queue.shift();

        if (!item) {
            this.isPlaying = false;
            return;
        }

        // インターバル
        if (this.interval > 0) {
            await sleep(this.interval * 1000);
        }

        // 同時再生
        if (item.simultaneous) {
            item.action.blendMode = THREE.AdditiveAnimationBlendMode;
            item.action.reset().fadeIn(TIME_CROSS_FADE / this.speedFactor).play();
            this.resume();
            return;
        }

        // 前のアクションからクロスフェードしつつ新しいアクションを再生する
        if (this.previousItem) {
            if (item.action === this.previousItem.action) {
                switch (REPEAT_TYPE_MAP[item.char]) {
                    case RepetitionTypes.SnapXMinus:
                    case RepetitionTypes.SnapXPlus:
                    case RepetitionTypes.SnapY:
                    case RepetitionTypes.SnapZ:
                        item.action.reset().play();
                        break;
                    default:
                        item.action.reset().play();
                        break;
                }
            } else {
                this.previousItem.action.crossFadeTo(item.action.reset(), TIME_CROSS_FADE / this.speedFactor, false).play();
            }
        } else {
            item.action.reset().fadeIn(TIME_CROSS_FADE / this.speedFactor).play();
        }
        this.previousItem = item;
        this.isPlaying = true;
    }

    #lastEnqueuedItem = null;

    /**
     * 単語をキューに追加して再生する
     * @param {string} word - 再生する単語
     */
    enqueue(word) {
        word = word.trim().hiraganaToKatakana();

        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            const prevChar = i > 0 ? word[i - 1] : this.#lastEnqueuedItem?.char;

            const item = {
                action: null,
                char: char,
                simultaneous: false,
                clone: false
            };

            item.action = this.actions.get(char);

            if (item.action) {
                // 同じ文字が連続する場合
                if (char == prevChar) {
                    const decorator = {
                        action: null,
                        char: null,
                        simultaneous: true
                    };
                    switch (REPEAT_TYPE_MAP[char]) {
                        case RepetitionTypes.Repeat:
                        case RepetitionTypes.RepeatF:
                            if (!this.#lastEnqueuedItem?.clone) {
                                let clone = this.actionsClone.get(char);
                                if (!clone) {
                                    const newClip = item.action.getClip().clone();
                                    const newAction = this.mixer.clipAction(newClip);
                                    newAction.setLoop(THREE.LoopOnce, 1);
                                    newAction.clampWhenFinished = true;
                                    this.actionsClone.set(char, newAction);
                                    clone = newAction;
                                }
                                item.action = clone;
                                item.clone = true;
                            }
                            break;
                        case RepetitionTypes.SnapXMinus:
                            decorator.action = this.actions.get('SnapX-');
                            break;
                        case RepetitionTypes.SnapXPlus:
                            decorator.action = this.actions.get('SnapX+');
                            break;
                        case RepetitionTypes.SnapY:
                            decorator.action = this.actions.get('SnapY');
                            break;
                        case RepetitionTypes.SnapZ:
                            decorator.action = this.actions.get('SnapZ');
                            break;
                        default:
                            break;
                    }
                    if (decorator.action) {
                        this.queue.push(decorator);
                    }
                }

                this.queue.push(item);
                this.#lastEnqueuedItem = item;
            }
        }

        console.debug(`キューに追加: ${word} (長さ: ${this.queue.length})`);

        if (!this.isPlaying) {
            this.resume();
        }
    }

    clearQueue() {
        this.queue.length = 0;
        this.#lastEnqueuedItem = null;
        this.isPlaying = false;
    }

    /**
     * 休止アクション(テ)を再生する
     */
    restPose() {
        this.enqueue('テ');
    }

    resetCamera(duration = 1000) {
        // 1. 開始時の位置と注視点を保持
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();

        // 2. リセット後の目標位置と目標注視点（通常は原点 (0,0,0)）
        const targetPosition = new THREE.Vector3(0, 0, 1.25);
        const targetTarget = new THREE.Vector3(0, 0, 0);

        const startTime = performance.now();

        const animateReset = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // イージング処理（スムーズに出発・停止するイージング: Ease-In-Out）
            const easeProgress = progress * progress * (3 - 2 * progress);

            // 位置と注視点を線形補間 (LERP)
            this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            this.controls.target.lerpVectors(startTarget, targetTarget, easeProgress);
            this.controls.update();

            // 1秒に達するまでフレーム更新を継続
            if (progress < 1) {
                requestAnimationFrame(animateReset);
            }
        };

        requestAnimationFrame(animateReset);
    }

    setFlipMode(flip) {
        if ((flip && this.scene.scale.x > 0) || (!flip && this.scene.scale.x < 0)) {
            this.scene.scale.x *= -1;
            this.controls.update();
        }
    }

    setPlaySpeed(factor) {
        this.speedFactor = factor;
    }

    /**
     * 単語再生時の文字と文字の間（インターバル）を設定する
     * @param {Number} interval 文字間のインターバル(秒)
     */
    setInterval(interval) {
        this.interval = interval;
    }
}

/**
 * クリップの再生時間を拡張する
 * @param {THREE.AnimationClip} clip - 対象のアニメーションクリップ
 * @param {number} duration - 新しい再生時間(s)
 */
function setClipDuration(clip, duration) {
    clip.tracks.forEach(track => {
        if (track.times.length > 0) {
            track.times[track.times.length - 1] = duration;
        }
    });
    clip.duration = duration;
}

const RepetitionTypes = Object.freeze({
    Repeat: 1,
    RepeatF: 2,
    SnapXMinus: 3,
    SnapXPlus: 4,
    SnapY: 5,
    SnapZ: 6
});

const REPEAT_TYPE_MAP =
{
    'ァ': RepetitionTypes.Repeat,
    'ア': RepetitionTypes.SnapY,
    'ィ': RepetitionTypes.Repeat,
    'イ': RepetitionTypes.SnapXMinus,
    'ゥ': RepetitionTypes.Repeat,
    'ウ': RepetitionTypes.SnapXMinus,
    'ェ': RepetitionTypes.Repeat,
    'エ': RepetitionTypes.SnapXMinus,
    'ォ': RepetitionTypes.Repeat,
    'オ': RepetitionTypes.SnapY,
    'カ': RepetitionTypes.RepeatF,
    'ガ': RepetitionTypes.Repeat,
    'キ': RepetitionTypes.RepeatF,
    'ギ': RepetitionTypes.Repeat,
    'ク': RepetitionTypes.SnapZ,
    'グ': RepetitionTypes.Repeat,
    'ケ': RepetitionTypes.SnapXMinus,
    'ゲ': RepetitionTypes.Repeat,
    'コ': RepetitionTypes.SnapZ,
    'ゴ': RepetitionTypes.Repeat,
    'サ': RepetitionTypes.SnapXMinus,
    'ザ': RepetitionTypes.Repeat,
    'シ': RepetitionTypes.SnapZ,
    'ジ': RepetitionTypes.Repeat,
    'ス': RepetitionTypes.SnapXMinus,
    'ズ': RepetitionTypes.Repeat,
    'セ': RepetitionTypes.SnapXMinus,
    'ゼ': RepetitionTypes.Repeat,
    'ソ': RepetitionTypes.SnapXMinus,
    'ゾ': RepetitionTypes.Repeat,
    'タ': RepetitionTypes.SnapZ,
    'ダ': RepetitionTypes.Repeat,
    'チ': RepetitionTypes.RepeatF,
    'ヂ': RepetitionTypes.Repeat,
    'ッ': RepetitionTypes.Repeat,
    'ツ': RepetitionTypes.RepeatF,
    'ヅ': RepetitionTypes.Repeat,
    'テ': RepetitionTypes.SnapXMinus,
    'デ': RepetitionTypes.Repeat,
    'ト': RepetitionTypes.SnapXPlus,
    'ド': RepetitionTypes.Repeat,
    'ナ': RepetitionTypes.SnapXMinus,
    'ニ': RepetitionTypes.SnapZ,
    'ヌ': RepetitionTypes.SnapZ,
    'ネ': RepetitionTypes.SnapXMinus,
    'ノ': RepetitionTypes.Repeat,
    'ハ': RepetitionTypes.SnapZ,
    'バ': RepetitionTypes.Repeat,
    'パ': RepetitionTypes.Repeat,
    'ヒ': RepetitionTypes.SnapXMinus,
    'ビ': RepetitionTypes.Repeat,
    'ピ': RepetitionTypes.Repeat,
    'フ': RepetitionTypes.SnapXMinus,
    'ブ': RepetitionTypes.Repeat,
    'プ': RepetitionTypes.Repeat,
    'ヘ': RepetitionTypes.SnapXMinus,
    'ベ': RepetitionTypes.Repeat,
    'ペ': RepetitionTypes.Repeat,
    'ホ': RepetitionTypes.SnapXPlus,
    'ボ': RepetitionTypes.Repeat,
    'ポ': RepetitionTypes.Repeat,
    'マ': RepetitionTypes.SnapXMinus,
    'ミ': RepetitionTypes.SnapZ,
    'ム': RepetitionTypes.SnapZ,
    'メ': RepetitionTypes.SnapY,
    'モ': RepetitionTypes.RepeatF,
    'ャ': RepetitionTypes.Repeat,
    'ヤ': RepetitionTypes.SnapXMinus,
    'ュ': RepetitionTypes.Repeat,
    'ユ': RepetitionTypes.SnapXPlus,
    'ョ': RepetitionTypes.Repeat,
    'ヨ': RepetitionTypes.SnapY,
    'ラ': RepetitionTypes.SnapXMinus,
    'リ': RepetitionTypes.Repeat,
    'ル': RepetitionTypes.SnapXMinus,
    'レ': RepetitionTypes.SnapXMinus,
    'ロ': RepetitionTypes.SnapY,
    'ワ': RepetitionTypes.SnapXMinus,
    'ヲ': RepetitionTypes.Repeat,
    'ン': RepetitionTypes.Repeat,
    'ヴ': RepetitionTypes.Repeat,
    'ー': RepetitionTypes.Repeat
}

/**
 * クォータニオンのトラックからX軸以外の回転を削除（Y=0, Z=0に固定）する関数
 * @param {THREE.QuaternionKeyframeTrack} track 
 */
function restrictToAxis(track, axis) {
    const times = track.times;
    const values = track.values;

    const tempQuaternion = new THREE.Quaternion();
    const tempEuler = new THREE.Euler(0, 0, 0, 'XYZ'); // 回転順序を指定

    // 1キーフレームあたり4要素（X, Y, Z, W）ずつループ
    for (let i = 0; i < times.length; i++) {
        const baseIndex = i * 4;

        // 1. 現在のクォータニオンを取得
        tempQuaternion.set(
            values[baseIndex + 0], // X
            values[baseIndex + 1], // Y
            values[baseIndex + 2], // Z
            values[baseIndex + 3]  // W
        );

        // 2. オイラー角に変換
        tempEuler.setFromQuaternion(tempQuaternion, 'XYZ');

        // 3. 指定された軸以外の回転を 0 に設定
        if (axis !== 'x') tempEuler.x = 0;
        if (axis !== 'y') tempEuler.y = 0;
        if (axis !== 'z') tempEuler.z = 0;

        // 4. クォータニオンに書き戻す
        tempQuaternion.setFromEuler(tempEuler);

        // 5. track.values を新しいクォータニオン値で上書き
        values[baseIndex + 0] = tempQuaternion.x;
        values[baseIndex + 1] = tempQuaternion.y;
        values[baseIndex + 2] = tempQuaternion.z;
        values[baseIndex + 3] = tempQuaternion.w;
    }
}
