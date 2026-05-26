import { useState, useCallback } from 'react';
import { Square, Pause, Play, Bookmark } from 'lucide-react';
import { useRecorder } from '../hooks/useRecorder';
import { WaveformCanvas } from '../components/WaveformCanvas';
import { MarkerSheet } from '../components/MarkerSheet';
import type { Marker, AppScreen } from '../types';
import { save } from '../store/recordings';
import { saveAudio } from '../store/db';

interface Props {
  onNavigate: (screen: AppScreen) => void;
  onRecordingSaved: () => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function defaultTitle(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function RecordingScreen({ onNavigate, onRecordingSaved }: Props) {
  const recorder = useRecorder();
  const [started, setStarted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [activeSheet, setActiveSheet] = useState<Marker | null>(null);
  const [markFlash, setMarkFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleStart = useCallback(async () => {
    await recorder.start();
    setStarted(true);
  }, [recorder]);

  const handleMark = useCallback(() => {
    if (recorder.state !== 'recording') return;
    const marker = recorder.addMarker();
    setMarkFlash(true);
    setTimeout(() => setMarkFlash(false), 300);
    setActiveSheet(marker);
  }, [recorder]);

  const handleStop = useCallback(async () => {
    setSaving(true);
    const result = await recorder.stop();
    if (!result) { setSaving(false); return; }

    const id = crypto.randomUUID();
    const now = Date.now();
    await saveAudio(id, result.blob);
    save({
      id,
      title: title.trim() || defaultTitle(),
      duration: result.duration,
      createdAt: now,
      updatedAt: now,
      markers: result.markers,
      mimeType: result.mimeType,
    });
    setSaving(false);
    onRecordingSaved();
    onNavigate({ name: 'playback', id });
  }, [recorder, title, onNavigate, onRecordingSaved]);

  const handleCancel = useCallback(async () => {
    await recorder.stop();
    onNavigate({ name: 'home' });
  }, [recorder, onNavigate]);

  return (
    <div className="screen rec-screen">
      <div className="rec-top-bar">
        <button className="top-btn" onClick={handleCancel}>Cancel</button>
        {editingTitle ? (
          <input
            className="rec-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
            autoFocus
          />
        ) : (
          <button className="rec-title-btn" onClick={() => setEditingTitle(true)}>
            {title}
          </button>
        )}
        <div style={{ width: 64 }} />
      </div>

      <div className="rec-waveform-area">
        {started ? (
          <WaveformCanvas mode="recording" liveData={recorder.waveformData} />
        ) : (
          <div className="rec-idle-hint">
            <div className="rec-idle-pulse" />
            <p>Tap the button below to start recording</p>
          </div>
        )}
      </div>

      <div className="rec-timer">{formatTime(recorder.elapsed)}</div>

      {started && (
        <div className="rec-markers-count">
          {recorder.markers.length > 0 && (
            <span className="markers-badge">{recorder.markers.length} marker{recorder.markers.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      <div className="rec-controls">
        {!started ? (
          <button className="rec-main-btn" onClick={handleStart}>
            <div className="rec-dot" />
          </button>
        ) : (
          <>
            <button
              className={`mark-btn ${markFlash ? 'flash' : ''}`}
              onClick={handleMark}
              disabled={recorder.state !== 'recording'}
            >
              <Bookmark size={20} />
              <span>Mark</span>
            </button>

            <button className="rec-main-btn" onClick={recorder.state === 'recording' ? recorder.pause : recorder.resume}>
              {recorder.state === 'recording' ? <Pause size={26} fill="white" /> : <Play size={26} fill="white" />}
            </button>

            <button className="stop-btn" onClick={handleStop} disabled={saving}>
              <Square size={20} fill="white" />
              <span>{saving ? 'Saving…' : 'Stop'}</span>
            </button>
          </>
        )}
      </div>

      <MarkerSheet
        marker={activeSheet}
        onSave={recorder.updateMarker}
        onDismiss={() => setActiveSheet(null)}
      />
    </div>
  );
}
