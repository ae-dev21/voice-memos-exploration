import { useEffect, useRef, useState } from 'react';
import type { Marker } from '../types';

interface Props {
  marker: Marker | null;
  onSave: (id: string, note: string) => void;
  onDismiss: () => void;
}

export function MarkerSheet({ marker, onSave, onDismiss }: Props) {
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (marker) {
      setNote(marker.note || '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [marker?.id]);

  if (!marker) return null;

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const save = () => {
    onSave(marker.id, note);
    onDismiss();
  };

  return (
    <>
      <div className="sheet-overlay" onClick={onDismiss} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-time">{formatTime(marker.timestamp)}</span>
          <span className="sheet-title">Add label</span>
          <button className="sheet-done" onClick={save}>Done</button>
        </div>
        <input
          ref={inputRef}
          className="sheet-input"
          placeholder="Chorus, key change, action item…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          maxLength={60}
        />
        <p className="sheet-hint">Optional — tap Done or swipe down to skip</p>
      </div>
    </>
  );
}
