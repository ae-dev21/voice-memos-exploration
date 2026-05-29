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
  const cs = Math.floor((secs % 1) * 100); // centiseconds
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function defaultTitle(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
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
    setTimeout(() => setMarkFlash(false), 280);
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

      {/* ── Translucent nav bar ── */}
      <div className="nav-bar">
        <button className="nav-btn" onClick={handleCancel}>
          Cancel
        </button>

        <div className="nav-title-area">
          {editingTitle ? (
            <input
              className="nav-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
              autoFocus
            />
          ) : (
            <button
              className="nav-title"
              style={{ background: 'none', cursor: 'text' }}
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </button>
          )}
          {/* Recording indicator dot */}
          {started && recorder.state === 'recording' && (
            <span style={{ fontSize: 9, color: 'var(--red)', letterSpacing: 1 }}>● REC</span>
          )}
          {started && recorder.state === 'paused' && (
            <span style={{ fontSize: 9, color: 'var(--label3)', letterSpacing: 1 }}>PAUSED</span>
          )}
        </div>

        <div style={{ minWidth: 64 }} />
      </div>

      {/* ── Live waveform ── */}
      <div className="rec-waveform-area">
        {started ? (
          <WaveformCanvas mode="recording" liveData={recorder.waveformData} />
        ) : (
          <div className="rec-idle-hint">
            <div className="rec-idle-pulse" />
            <p>Tap record to begin</p>
          </div>
        )}
      </div>

      {/* ── Timer ── */}
      <div className="rec-timer">{formatTime(recorder.elapsed)}</div>

      {/* ── Marker count ── */}
      {started && (
        <div className="rec-markers-count">
          {recorder.markers.length > 0 && (
            <span className="markers-badge">
              {recorder.markers.length} marker{recorder.markers.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Controls ── */}
      <div className="rec-controls">
        {!started ? (
          /* Idle: single large record button */
          <button className="rec-start-btn" onClick={handleStart}>
            <div className="rec-dot" />
          </button>
        ) : (
          <>
            {/* Mark */}
            <button
              className={`mark-btn ${markFlash ? 'flash' : ''}`}
              onClick={handleMark}
              disabled={recorder.state !== 'recording'}
            >
              <Bookmark size={18} />
              <span>Mark</span>
            </button>

            {/* Pause / Resume */}
            <button
              className="rec-main-btn"
              onClick={recorder.state === 'recording' ? recorder.pause : recorder.resume}
            >
              {recorder.state === 'recording'
                ? <Pause size={26} fill="white" strokeWidth={0} />
                : <Play size={26} fill="white" strokeWidth={0} style={{ marginLeft: 3 }} />}
            </button>

            {/* Stop */}
            <button className="stop-btn" onClick={handleStop} disabled={saving}>
              <Square size={18} fill="white" strokeWidth={0} />
              <span>{saving ? 'Saving' : 'Stop'}</span>
            </button>
          </>
        )}
      </div>

      {/* ── Marker label sheet ── */}
      <MarkerSheet
        marker={activeSheet}
        onSave={recorder.updateMarker}
        onDismiss={() => setActiveSheet(null)}
      />
    </div>
  );
}
