import { useEffect, useRef, useState } from 'react';
import { LocalParticipant } from 'livekit-client';

// Use global faceapi from CDN to avoid Vite build issues
declare const faceapi: any;

export interface FaceTelemetry {
  expressions: { [key: string]: number };
  blinkCount: number;
  confidence: number;
  timestamp: number;
}

export function useFaceAnalyzer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  participant: LocalParticipant | undefined,
  intervalMs: number = 100
) {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const blinkCountRef = useRef(0);
  const lastEyeRatioRef = useRef(0.3);
  const telemetryIntervalRef = useRef<number | null>(null);

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        console.log('Face API models loaded');
      } catch (e) {
        console.error('Failed to load face API models', e);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !videoRef.current || !participant) return;

    const video = videoRef.current;

    // Helper: calculate Eye Aspect Ratio (EAR)
    // Points 36-41 (left eye) and 42-47 (right eye)
    const getEAR = (eye: any[]) => {
      const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
      const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
      const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
      return (v1 + v2) / (2.0 * h);
    };

    const analyzeFace = async () => {
      if (video.paused || video.ended) return;

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

        // Blink detection threshold
        if (ear < 0.25 && lastEyeRatioRef.current >= 0.25) {
          blinkCountRef.current += 1;
        }
        lastEyeRatioRef.current = ear;

        // Calculate heuristic confidence
        // Higher confidence = mostly neutral or happy, low fearful/sad/disgusted
        const expr = detection.expressions;
        let confidence = (expr.neutral + expr.happy) - (expr.sad + expr.fearful + expr.disgusted + expr.angry);
        confidence = Math.max(0, Math.min(1, (confidence + 1) / 2)); // Normalize to 0-1

        const telemetry: FaceTelemetry = {
          expressions: {
            neutral: expr.neutral,
            happy: expr.happy,
            sad: expr.sad,
            angry: expr.angry,
            fear: expr.fearful,
            surprised: expr.surprised,
          },
          blinkCount: blinkCountRef.current,
          confidence,
          timestamp: Date.now(),
        };

        // Publish over LiveKit Data Channel
        const encoder = new TextEncoder();
        const payload = encoder.encode(JSON.stringify({ type: 'telemetry', data: telemetry }));
        participant.publishData(payload, { reliable: false });
      }
    };

    telemetryIntervalRef.current = window.setInterval(analyzeFace, intervalMs);

    return () => {
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
      }
    };
  }, [modelsLoaded, participant, videoRef, intervalMs]);

  return { modelsLoaded, currentBlinks: blinkCountRef.current };
}
