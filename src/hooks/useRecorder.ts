import { useRef, useState, useCallback, useEffect } from 'react';
import type { Marker } from '../types';

export type RecorderState = 'idle' | 'recording' | 'paused';

export interface RecorderResult {
  state: RecorderState;
  elapsed: number;
  waveformData: Uint8Array;
  markers: Marker[];
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ blob: Blob; mimeType: string; duration: number; markers: Marker[] } | null>;
  addMarker: () => Marker;
  updateMarker: (id: string, note: string) => void;
}

export function useRecorder(): RecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [waveformData, setWaveformData] = useState<Uint8Array>(new Uint8Array(64));
  const [markers, setMarkersState] = useState<Marker[]>([]);

  const markersRef = useRef<Marker[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setMarkers = useCallback((updater: Marker[] | ((prev: Marker[]) => Marker[])) => {
    const next = typeof updater === 'function' ? updater(markersRef.current) : updater;
    markersRef.current = next;
    setMarkersState(next);
  }, []);

  const drawLoop = useCallback(() => {
    if (!analyserRef.current) return;
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(buf);
    setWaveformData(buf);
    animFrameRef.current = requestAnimationFrame(drawLoop);
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    analyserRef.current = analyser;

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((t) =>
      MediaRecorder.isTypeSupported(t)
    ) ?? '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100);
    startTimeRef.current = Date.now();
    pausedElapsedRef.current = 0;
    setElapsed(0);
    setMarkers([]);
    setState('recording');

    timerRef.current = setInterval(() => {
      setElapsed(pausedElapsedRef.current + (Date.now() - startTimeRef.current) / 1000);
    }, 50);

    animFrameRef.current = requestAnimationFrame(drawLoop);
  }, [drawLoop, setMarkers]);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      pausedElapsedRef.current += (Date.now() - startTimeRef.current) / 1000;
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setState('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      startTimeRef.current = Date.now();
      setState('recording');
      timerRef.current = setInterval(() => {
        setElapsed(pausedElapsedRef.current + (Date.now() - startTimeRef.current) / 1000);
      }, 50);
      animFrameRef.current = requestAnimationFrame(drawLoop);
    }
  }, [drawLoop]);

  const stop = useCallback((): Promise<{ blob: Blob; mimeType: string; duration: number; markers: Marker[] } | null> => {
    return new Promise((resolve) => {
      if (!recorderRef.current) return resolve(null);

      const duration =
        pausedElapsedRef.current +
        (recorderRef.current.state === 'paused' ? 0 : (Date.now() - startTimeRef.current) / 1000);
      const mimeType = recorderRef.current.mimeType;

      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);

      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        audioCtxRef.current?.close();
        const captured = markersRef.current.slice();
        setState('idle');
        setElapsed(0);
        setMarkers([]);
        resolve({ blob, mimeType, duration, markers: captured });
      };

      recorderRef.current.stop();
    });
  }, [setMarkers]);

  const addMarker = useCallback((): Marker => {
    const timestamp =
      pausedElapsedRef.current + (Date.now() - startTimeRef.current) / 1000;
    const marker: Marker = { id: crypto.randomUUID(), timestamp, note: '' };
    setMarkers((prev) => [...prev, marker]);
    return marker;
  }, [setMarkers]);

  const updateMarker = useCallback((id: string, note: string) => {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, note } : m)));
  }, [setMarkers]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  return { state, elapsed, waveformData, markers, start, pause, resume, stop, addMarker, updateMarker };
}
