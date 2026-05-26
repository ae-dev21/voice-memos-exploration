import { useRef, useEffect } from 'react';
import type { Marker } from '../types';

interface Props {
  mode: 'recording' | 'playback';
  liveData?: Uint8Array;
  staticBars?: number[];
  markers?: Marker[];
  duration?: number;
  currentTime?: number;
  onSeek?: (t: number) => void;
}

export function WaveformCanvas({ mode, liveData, staticBars, markers = [], duration = 0, currentTime = 0, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (mode === 'recording') {
      // Push latest amplitude sample
      if (liveData && liveData.length > 0) {
        let sum = 0;
        for (let i = 0; i < liveData.length; i++) sum += Math.abs(liveData[i] - 128);
        const amp = Math.min((sum / liveData.length) / 128, 1);
        liveHistoryRef.current.push(amp);
      }

      const barW = 3;
      const gap = 2;
      const maxBars = Math.floor(w / (barW + gap));
      const history = liveHistoryRef.current.slice(-maxBars);

      const minH = 3;
      const maxH = h * 0.75;

      history.forEach((amp, i) => {
        const x = i * (barW + gap);
        const bh = Math.max(minH, amp * maxH);
        const y = (h - bh) / 2;
        const progress = i / history.length;
        ctx.fillStyle = `rgba(255, 59, 48, ${0.4 + progress * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, bh, 1.5);
        ctx.fill();
      });
    } else {
      // Static waveform for playback
      const bars = staticBars ?? [];
      if (bars.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(w / 2 - 1, 0, 2, h);
        return;
      }

      const barW = (w / bars.length) * 0.6;
      const gap = (w / bars.length) * 0.4;
      const playedFraction = duration > 0 ? currentTime / duration : 0;
      const playedPx = playedFraction * w;

      bars.forEach((amp, i) => {
        const x = i * (barW + gap);
        const bh = Math.max(3, amp * h * 0.8);
        const y = (h - bh) / 2;
        const isPast = x + barW / 2 < playedPx;
        ctx.fillStyle = isPast ? '#0A84FF' : 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(x, y, barW, bh, 1.5);
        ctx.fill();
      });

      // Playhead
      ctx.strokeStyle = '#0A84FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playedPx, 4);
      ctx.lineTo(playedPx, h - 4);
      ctx.stroke();

      // Dot on playhead
      ctx.fillStyle = '#0A84FF';
      ctx.beginPath();
      ctx.arc(playedPx, 6, 5, 0, Math.PI * 2);
      ctx.fill();

      // Marker lines
      markers.forEach((m) => {
        const mx = duration > 0 ? (m.timestamp / duration) * w : 0;
        ctx.strokeStyle = 'rgba(255, 214, 10, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marker dot at top
        ctx.fillStyle = '#FFD60A';
        ctx.beginPath();
        ctx.arc(mx, 6, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || mode !== 'playback') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    onSeek(t);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: mode === 'playback' ? 'pointer' : 'default' }}
      onClick={handleClick}
    />
  );
}
