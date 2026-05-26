import { useRef, useState, useCallback, useEffect } from 'react';

export interface PlayerResult {
  playing: boolean;
  currentTime: number;
  duration: number;
  staticBars: number[];
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  skipBy: (secs: number) => void;
  load: (blob: Blob) => Promise<void>;
}

export function usePlayer(): PlayerResult {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [staticBars, setStaticBars] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const load = useCallback(async (blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);

    const url = URL.createObjectURL(blob);
    urlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    await new Promise<void>((res) => {
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        setCurrentTime(0);
        res();
      };
    });

    // Decode and build static waveform
    try {
      const arrayBuf = await blob.arrayBuffer();
      const audioCtx = new AudioContext();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      await audioCtx.close();

      const channel = decoded.getChannelData(0);
      const barCount = 120;
      const blockSize = Math.floor(channel.length / barCount);
      const bars: number[] = [];
      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channel[i * blockSize + j] ?? 0);
        }
        bars.push(sum / blockSize);
      }
      const max = Math.max(...bars, 0.001);
      setStaticBars(bars.map((v) => v / max));
    } catch {
      setStaticBars([]);
    }
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play();
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const seek = useCallback((t: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(t, audioRef.current.duration));
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const skipBy = useCallback((secs: number) => {
    if (audioRef.current) {
      seek(audioRef.current.currentTime + secs);
    }
  }, [seek]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { playing, currentTime, duration, staticBars, play, pause, seek, skipBy, load };
}
