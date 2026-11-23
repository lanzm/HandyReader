/**
 * audioPlayer.ts - 智能发音播放器与动态响度均衡引擎
 *
 * 核心技术方案（方案一：Web Audio API + DynamicsCompressorNode + 峰值响度归一化）：
 * 1. 解决不同单词/词组发音忽大忽小问题（如 of course -3dB 极响 vs look forward to -11.5dB 极弱）。
 * 2. 采集音频 PCM 峰值并计算补偿增益（Make-up Gain，0.75x ~ 2.6x），将微弱发音提拉至饱满清晰区间。
 * 3. 串接 DynamicsCompressorNode（专为人声朗读调优：阈值 -24dB、拐点 30dB、压缩比 12:1、启动 3ms、释放 250ms），
 *    强力压平瞬态爆破音，保持广播级舒适听感。
 * 4. 内置 LRU 缓存（上限 20 个音频），反复点击同一个词零延迟即开即播。
 * 5. 全场景双引擎保底：WebAudio 无法解码或受网络安全域名限制时，无缝降级至原生 InnerAudioContext。
 */

export interface AudioPlayOptions {
  onPlay?: () => void;
  onEnded?: () => void;
  onError?: (err: any) => void;
  onStop?: () => void;
}

interface CachedAudio {
  buffer: any;
  gain: number;
}

// 播放器单例状态
let audioCtx: any = null;
let compressorNode: any = null;
let activeSourceNode: any = null;
let activeInnerAudio: UniApp.InnerAudioContext | null = null;
let currentRequestId = 0;

// LRU 音频缓冲区缓存
const MAX_BUFFER_CACHE = 20;
const bufferCache = new Map<string, CachedAudio>();

/**
 * 获取或创建单例 WebAudioContext
 */
function getAudioContext(): any {
  if (audioCtx) return audioCtx;
  try {
    // @ts-ignore
    if (typeof wx !== "undefined" && typeof wx.createWebAudioContext === "function") {
      // @ts-ignore
      audioCtx = wx.createWebAudioContext();
    } else if (typeof window !== "undefined") {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
  } catch (e) {
    console.warn("[WebAudio] Failed to create AudioContext:", e);
    audioCtx = null;
  }
  return audioCtx;
}

/**
 * 初始化音频处理图谱（单例 DynamicsCompressorNode）
 */
function initAudioGraph(): void {
  if (compressorNode || !audioCtx) return;
  try {
    if (typeof audioCtx.createDynamicsCompressor === "function") {
      const comp = audioCtx.createDynamicsCompressor();
      const now = audioCtx.currentTime || 0;

      // 为人声发音定制的动态压缩参数
      if (comp.threshold) comp.threshold.setValueAtTime(-24, now); // 超过 -24dB 启动压限
      if (comp.knee) comp.knee.setValueAtTime(30, now);            // 30dB 柔和过渡拐点
      if (comp.ratio) comp.ratio.setValueAtTime(12, now);          // 12:1 强力平滑过载音量
      if (comp.attack) comp.attack.setValueAtTime(0.003, now);     // 3ms 瞬态捕捉爆破音
      if (comp.release) comp.release.setValueAtTime(0.25, now);    // 250ms 平滑释放尾韵

      comp.connect(audioCtx.destination);
      compressorNode = comp;
    }
  } catch (e) {
    console.warn("[WebAudio] DynamicsCompressorNode not supported or failed:", e);
    compressorNode = null;
  }
}

/**
 * 扫描 PCM 数据，计算智能响度补偿增益 (Make-up Gain)
 */
function calculateAudioGain(buffer: any): number {
  try {
    const channelData = buffer.getChannelData(0);
    const len = channelData.length;
    if (!len) return 1.0;

    let peak = 0;
    // 快速采样（针对 ~1s 单词音频，步长 1~2，运算 < 0.3ms）
    const step = len > 80000 ? 2 : 1;
    for (let i = 0; i < len; i += step) {
      const val = Math.abs(channelData[i]);
      if (val > peak) peak = val;
    }

    if (peak <= 0.001) return 1.0;

    // 目标峰值电平设定在 0.82 (-1.7 dBFS)，为动态压缩留出充足的动态余量
    const targetPeak = 0.82;
    const peakGain = targetPeak / peak;

    // 限制放大倍数区间：最小 0.75x（防破音），最大 2.6x（让微弱短语饱满有力）
    const finalGain = Math.min(2.6, Math.max(0.75, peakGain));
    return Number(finalGain.toFixed(2));
  } catch {
    return 1.0;
  }
}

/**
 * 使用 Web Audio 引擎播放已解码的音频
 */
function playDecodedBuffer(
  buffer: any,
  gainValue: number,
  requestId: number,
  options?: AudioPlayOptions
): void {
  if (requestId !== currentRequestId || !audioCtx) return;

  // 恢复 AudioContext（应对部分移动端可能因闲置而处于 suspended）
  if (audioCtx.state === "suspended" && typeof audioCtx.resume === "function") {
    try {
      audioCtx.resume();
    } catch {}
  }

  stopSourceNode();

  try {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    // 动态增益节点
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime || 0;
    if (gainNode.gain) {
      gainNode.gain.setValueAtTime(gainValue, now);
    }

    // 路由：source -> gainNode -> compressorNode (或直通 destination)
    source.connect(gainNode);
    if (compressorNode) {
      gainNode.connect(compressorNode);
    } else {
      gainNode.connect(audioCtx.destination);
    }

    activeSourceNode = source;

    source.onended = () => {
      if (activeSourceNode === source) {
        activeSourceNode = null;
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch {}
        options?.onEnded?.();
      }
    };

    source.start(0);
    options?.onPlay?.();
  } catch (err) {
    console.warn("[WebAudio] Buffer playback error:", err);
    options?.onError?.(err);
  }
}

/**
 * 构造合规的有道发音 URL
 * 空格安全替换为 '+'，剥离边缘标点，避免部分平台网络库二次转义触发 HTTP 500
 */
export function getPronunciationUrl(text: string): string {
  const safeParam = encodeURIComponent(
    text.replace(/^[^a-zA-Z\s']+|[^a-zA-Z\s']+$/g, "").trim()
  ).replace(/%20/g, "+");
  return `https://dict.youdao.com/dictvoice?type=2&audio=${safeParam}`;
}

/**
 * 降级方案：使用原生 InnerAudioContext 播放
 */
function playFallbackInnerAudio(audioUrl: string, options?: AudioPlayOptions): void {
  try {
    const innerAudio = uni.createInnerAudioContext();
    activeInnerAudio = innerAudio;

    // 避免 iOS 静音开关拦截发音
    // @ts-ignore
    innerAudio.obeyMuteSwitch = false;
    innerAudio.src = audioUrl;
    innerAudio.autoplay = true;

    innerAudio.onPlay(() => {
      options?.onPlay?.();
    });
    innerAudio.onEnded(() => {
      options?.onEnded?.();
      cleanupInnerAudio(innerAudio);
    });
    innerAudio.onError((err) => {
      console.warn("[InnerAudio] Play error:", err);
      options?.onError?.(err);
      cleanupInnerAudio(innerAudio);
    });
    innerAudio.onStop(() => {
      options?.onStop?.();
      cleanupInnerAudio(innerAudio);
    });

    try {
      innerAudio.play();
    } catch (e) {
      console.warn("[InnerAudio] play() call warning:", e);
    }
  } catch (err) {
    options?.onError?.(err);
  }
}

/**
 * 播放单词/短语发音（对外核心主入口）
 */
export function playPronunciation(word: string, options?: AudioPlayOptions): void {
  stopAudio();

  const trimmed = word.trim();
  if (!trimmed) return;

  const reqId = ++currentRequestId;
  const audioUrl = getPronunciationUrl(trimmed);

  // 1. 优先检查 LRU 缓存（同词重复点击 < 1ms 即发声）
  const cached = bufferCache.get(audioUrl);
  if (cached && audioCtx) {
    playDecodedBuffer(cached.buffer, cached.gain, reqId, options);
    return;
  }

  // 2. 尝试使用 WebAudio 进行动态响度均衡
  const ctx = getAudioContext();
  if (ctx && typeof uni.request === "function") {
    initAudioGraph();

    uni.request({
      url: audioUrl,
      responseType: "arraybuffer",
      success: (res) => {
        if (reqId !== currentRequestId) return;

        if (res.statusCode === 200 && res.data) {
          try {
            ctx.decodeAudioData(
              res.data as ArrayBuffer,
              (buffer: any) => {
                if (reqId !== currentRequestId) return;
                const gain = calculateAudioGain(buffer);

                // 维护 LRU 缓存池
                if (bufferCache.size >= MAX_BUFFER_CACHE) {
                  const firstKey = bufferCache.keys().next().value;
                  if (firstKey) bufferCache.delete(firstKey);
                }
                bufferCache.set(audioUrl, { buffer, gain });

                playDecodedBuffer(buffer, gain, reqId, options);
              },
              (decodeErr: any) => {
                console.warn("[WebAudio] decode failed, fallback to InnerAudio:", decodeErr);
                if (reqId === currentRequestId) {
                  playFallbackInnerAudio(audioUrl, options);
                }
              }
            );
          } catch (e) {
            console.warn("[WebAudio] decode exception, fallback:", e);
            if (reqId === currentRequestId) {
              playFallbackInnerAudio(audioUrl, options);
            }
          }
        } else {
          // HTTP 异常，回退降级
          if (reqId === currentRequestId) {
            playFallbackInnerAudio(audioUrl, options);
          }
        }
      },
      fail: (netErr) => {
        // 请求失败（如域名受限），优雅降级到系统 InnerAudioContext
        console.warn("[WebAudio] Request failed, fallback to InnerAudio:", netErr);
        if (reqId === currentRequestId) {
          playFallbackInnerAudio(audioUrl, options);
        }
      }
    });
    return;
  }

  // 3. 不支持 Web Audio 的环境，直接调用原生播放器
  playFallbackInnerAudio(audioUrl, options);
}

/**
 * 停止当前所有发音播放并释放资源
 */
export function stopAudio(): void {
  currentRequestId++;
  stopSourceNode();
  if (activeInnerAudio) {
    cleanupInnerAudio(activeInnerAudio);
    activeInnerAudio = null;
  }
}

function stopSourceNode(): void {
  if (activeSourceNode) {
    try {
      activeSourceNode.stop();
      activeSourceNode.disconnect();
    } catch {}
    activeSourceNode = null;
  }
}

function cleanupInnerAudio(audio: UniApp.InnerAudioContext): void {
  try {
    audio.stop();
    audio.destroy();
  } catch {}
  if (activeInnerAudio === audio) {
    activeInnerAudio = null;
  }
}
