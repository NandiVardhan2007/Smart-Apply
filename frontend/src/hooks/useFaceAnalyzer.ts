import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

export interface FaceTelemetrySummary {
  avg_confidence: number;
  blink_count: number;
}

let modelsLoadedGlobally = false;

/**
 * Loads face-api's tiny models once per session and, while `isActive`,
 * periodically samples the video feed for blink count (via eye-aspect-ratio)
 * and an overall "confidence" score derived from expression weights. Used
 * by the Live Interview page to summarize non-verbal telemetry for the
 * post-interview report.
 */
export function useFaceAnalyzer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
  intervalMs: number = 100
) {
  const [modelsLoaded, setModelsLoaded] = useState(modelsLoadedGlobally);
  const blinkCountRef = useRef(0);
  const lastEyeRatioRef = useRef(0.3);
  const telemetryIntervalRef = useRef<number | null>(null);

  const confidenceSumRef = useRef(0);
  const confidenceCountRef = useRef(0);

  useEffect(() => {
    if (modelsLoadedGlobally) {
      setModelsLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (!cancelled) {
          modelsLoadedGlobally = true;
          setModelsLoaded(true);
        }
      } catch (e) {
        console.error('Failed to load face-api models', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !videoRef.current || !isActive) return;

    const video = videoRef.current;

    const getEAR = (eye: faceapi.Point[]) => {
      const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
      const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
      const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
      return (v1 + v2) / (2.0 * h);
    };

    const analyzeFace = async () => {
      if (video.paused || video.ended) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detection) {
          const landmarks = detection.landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          const leftEAR = getEAR(leftEye);
          const rightEAR = getEAR(rightEye);
          const ear = (leftEAR + rightEAR) / 2;

          if (ear < 0.25 && lastEyeRatioRef.current >= 0.25) {
            blinkCountRef.current += 1;
          }
          lastEyeRatioRef.current = ear;

          const expr = detection.expressions;
          let confidence = expr.neutral + expr.happy - (expr.sad + expr.fearful + expr.disgusted + expr.angry);
          confidence = Math.max(0, Math.min(1, (confidence + 1) / 2));

          confidenceSumRef.current += confidence;
          confidenceCountRef.current += 1;
        }
      } catch {
        // A missed frame isn't worth surfacing — just skip it.
      }
    };

    telemetryIntervalRef.current = window.setInterval(analyzeFace, intervalMs);

    return () => {
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
      }
    };
  }, [modelsLoaded, isActive, videoRef, intervalMs]);

  const getTelemetrySummary = useCallback((): FaceTelemetrySummary => {
    const avgConfidence =
      confidenceCountRef.current > 0 ? confidenceSumRef.current / confidenceCountRef.current : 0;

    return {
      avg_confidence: avgConfidence,
      blink_count: blinkCountRef.current,
    };
  }, []);

  return { modelsLoaded, getTelemetrySummary };
}
