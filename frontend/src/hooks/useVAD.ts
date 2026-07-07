import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Voice Activity Detection hook.
 *
 * Monitors a MediaStream's audio for speech by computing the RMS energy
 * on every animation frame and comparing it to a configurable threshold.
 * A debounce window prevents micro-silences (plosives, brief pauses) from
 * toggling the state on-and-off rapidly, and a minimum-onset period avoids
 * false triggers from stray keyboard clicks or room noise.
 *
 * Returns:
 *   isSpeaking  – stable boolean that goes `true` when sustained speech
 *                 is detected and `false` after a silence gap.
 *   rmsLevel    – the raw 0-1 RMS value, useful for driving visualizers.
 */

export interface UseVADOptions {
  /** RMS threshold above which audio is considered "speech" (0-1). Default 0.015. */
  threshold?: number;
  /** Consecutive ms of silence before speech is considered ended. Default 600. */
  silenceDelay?: number;
  /** Consecutive ms of sound before speech onset is confirmed. Default 100. */
  onsetDelay?: number;
}

export interface UseVADReturn {
  isSpeaking: boolean;
  rmsLevel: number;
}

export function useVAD(
  stream: MediaStream | null,
  enabled: boolean,
  options: UseVADOptions = {}
): UseVADReturn {
  const {
    threshold = 0.015,
    silenceDelay = 600,
    onsetDelay = 100,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rmsLevel, setRmsLevel] = useState(0);

  // Mutable refs so the RAF loop always reads the latest values
  // without needing to restart.
  const speakingRef = useRef(false);
  const onsetStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);

  const setVADSpeaking = useCallback((val: boolean) => {
    if (speakingRef.current !== val) {
      speakingRef.current = val;
      setIsSpeaking(val);
    }
  }, []);

  useEffect(() => {
    if (!stream || !enabled) {
      setVADSpeaking(false);
      setRmsLevel(0);
      return;
    }

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let animationId: number;
    let disposed = false;

    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch (err) {
      console.error('[useVAD] Failed to create AudioContext', err);
      return;
    }

    const dataArray = new Float32Array(analyser.fftSize);

    const tick = () => {
      if (disposed) return;

      analyser.getFloatTimeDomainData(dataArray);

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setRmsLevel(rms);

      const now = performance.now();
      const aboveThreshold = rms > threshold;

      if (aboveThreshold) {
        // Reset the silence timer whenever we hear sound
        silenceStartRef.current = null;

        if (!speakingRef.current) {
          // Not yet speaking — check onset debounce
          if (onsetStartRef.current === null) {
            onsetStartRef.current = now;
          } else if (now - onsetStartRef.current >= onsetDelay) {
            setVADSpeaking(true);
          }
        }
      } else {
        // Below threshold
        onsetStartRef.current = null;

        if (speakingRef.current) {
          // Currently speaking — start silence countdown
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current >= silenceDelay) {
            setVADSpeaking(false);
          }
        }
      }

      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      source.disconnect();
      analyser.disconnect();
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
      onsetStartRef.current = null;
      silenceStartRef.current = null;
    };
  }, [stream, enabled, threshold, silenceDelay, onsetDelay, setVADSpeaking]);

  return { isSpeaking, rmsLevel };
}
