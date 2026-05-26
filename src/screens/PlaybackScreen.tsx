import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, RotateCw, Trash2, Repeat, Edit3, Check, X } from 'lucide-react';
import { usePlayer } from '../hooks/usePlayer';
import { WaveformCanvas } from '../components/WaveformCanvas';
import type { Recording, Marker, AppScreen } from '../types';
import { getById, save, remove } from '../store/recordings';
import { getAudio, deleteAudio } from '../store/db';

interface Props {
  recordingId: string;
  onNavigate: (screen: AppScreen) => void;
  onRecordingsChanged: () => void;
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function formatMarkerTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export function PlaybackScreen({ recordingId, onNavigate, onRecordingsChanged }: Props) {
  const player = usePlayer();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [looping, setLooping] = useState(false);
  const [loopMarkerId, setLoopMarkerId] = useState<string | null>(null);
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const loopRef = useRef({ active: false, start: 0, end: 0 });

  useEffect(() => {
    const r = getById(recordingId);
    if (!r) return;
    setRecording(r);
    setTitleDraft(r.title);

    getAudio(recordingId).then((blob) => {
      if (blob) return player.load(blob);
    }).then(() => setLoaded(true));
  }, [recordingId]);

  // Track active marker during playback
  useEffect(() => {
    if (!recording) return;
    const sorted = [...recording.markers].sort((a, b) => a.timestamp - b.timestamp);
    const active = sorted.filter((m) => m.timestamp <= player.currentTime).pop();
    setActiveMarkerId(active?.id ?? null);
  }, [player.currentTime, recording]);

  // Loop logic
  useEffect(() => {
    if (!looping || !loopMarkerId || !recording) return;
    const marker = recording.markers.find((m) => m.id === loopMarkerId);
    if (!marker) return;

    const start = marker.timestamp;
    const sorted = [...recording.markers].sort((a, b) => a.timestamp - b.timestamp);
    const idx = sorted.findIndex((m) => m.id === loopMarkerId);
    const end = sorted[idx + 1]?.timestamp ?? player.duration;
    loopRef.current = { active: true, start, end };
  }, [looping, loopMarkerId, recording, player.duration]);

  useEffect(() => {
    if (!loopRef.current.active) return;
    const { start, end } = loopRef.current;
    if (player.currentTime >= end) {
      player.seek(start);
    }
  }, [player.currentTime]);

  const jumpToMarker = (marker: Marker) => {
    player.seek(marker.timestamp);
    if (!player.playing) player.play();
  };

  const toggleLoop = (markerId: string) => {
    if (looping && loopMarkerId === markerId) {
      setLooping(false);
      setLoopMarkerId(null);
      loopRef.current.active = false;
    } else {
      setLooping(true);
      setLoopMarkerId(markerId);
      const marker = recording?.markers.find((m) => m.id === markerId);
      if (marker) player.seek(marker.timestamp);
    }
  };

  const saveMarkerNote = (id: string) => {
    if (!recording) return;
    const updated: Recording = {
      ...recording,
      markers: recording.markers.map((m) => m.id === id ? { ...m, note: editNote } : m),
      updatedAt: Date.now(),
    };
    save(updated);
    setRecording(updated);
    setEditingMarker(null);
  };

  const deleteMarker = (id: string) => {
    if (!recording) return;
    const updated: Recording = {
      ...recording,
      markers: recording.markers.filter((m) => m.id !== id),
      updatedAt: Date.now(),
    };
    save(updated);
    setRecording(updated);
  };

  const saveTitle = () => {
    if (!recording) return;
    const updated = { ...recording, title: titleDraft.trim() || recording.title, updatedAt: Date.now() };
    save(updated);
    setRecording(updated);
    setEditingTitle(false);
  };

  const handleDelete = useCallback(async () => {
    if (!recording) return;
    remove(recording.id);
    await deleteAudio(recording.id);
    onRecordingsChanged();
    onNavigate({ name: 'home' });
  }, [recording, onNavigate, onRecordingsChanged]);

  const sortedMarkers = recording ? [...recording.markers].sort((a, b) => a.timestamp - b.timestamp) : [];

  return (
    <div className="screen playback-screen">
      <div className="pb-top-bar">
        <button className="top-btn icon-btn" onClick={() => onNavigate({ name: 'home' })}>
          <ArrowLeft size={20} />
        </button>
        <div className="pb-title-area">
          {editingTitle ? (
            <div className="pb-title-edit">
              <input
                className="pb-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                autoFocus
              />
              <button className="icon-btn-sm" onClick={saveTitle}><Check size={16} /></button>
              <button className="icon-btn-sm" onClick={() => setEditingTitle(false)}><X size={16} /></button>
            </div>
          ) : (
            <button className="pb-title-btn" onClick={() => setEditingTitle(true)}>
              {recording?.title}
            </button>
          )}
          <span className="pb-duration">{loaded ? formatTime(player.duration) : '—'}</span>
        </div>
        <button className="top-btn icon-btn danger" onClick={handleDelete}>
          <Trash2 size={18} />
        </button>
      </div>

      <div className="pb-waveform-area">
        {loaded ? (
          <WaveformCanvas
            mode="playback"
            staticBars={player.staticBars}
            markers={recording?.markers ?? []}
            duration={player.duration}
            currentTime={player.currentTime}
            onSeek={player.seek}
          />
        ) : (
          <div className="pb-loading">Loading…</div>
        )}
      </div>

      <div className="pb-time">{formatTime(player.currentTime)}</div>

      <div className="pb-transport">
        <button className="transport-btn" onClick={() => player.skipBy(-15)}>
          <RotateCcw size={22} />
          <span>15</span>
        </button>
        <button
          className="pb-play-btn"
          onClick={player.playing ? player.pause : player.play}
          disabled={!loaded}
        >
          {player.playing ? <Pause size={26} fill="white" /> : <Play size={26} fill="white" />}
        </button>
        <button className="transport-btn" onClick={() => player.skipBy(15)}>
          <RotateCw size={22} />
          <span>15</span>
        </button>
      </div>

      {sortedMarkers.length > 0 && (
        <div className="pb-markers-section">
          <div className="pb-markers-header">
            <span className="pb-markers-label">Markers</span>
            <span className="pb-markers-count">{sortedMarkers.length}</span>
          </div>
          <div className="pb-markers-list">
            {sortedMarkers.map((marker) => {
              const isActive = activeMarkerId === marker.id;
              const isLooping = looping && loopMarkerId === marker.id;
              return (
                <div
                  key={marker.id}
                  className={`pb-marker-row ${isActive ? 'active' : ''}`}
                  onClick={() => jumpToMarker(marker)}
                >
                  <div className="pb-marker-time">{formatMarkerTime(marker.timestamp)}</div>
                  <div className="pb-marker-body">
                    {editingMarker === marker.id ? (
                      <div className="pb-marker-edit">
                        <input
                          className="pb-marker-input"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveMarkerNote(marker.id)}
                          autoFocus
                          placeholder="Add label…"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); saveMarkerNote(marker.id); }}>
                          <Check size={14} />
                        </button>
                        <button className="icon-btn-sm" onClick={(e) => { e.stopPropagation(); setEditingMarker(null); }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="pb-marker-note">{marker.note || <em>No label</em>}</span>
                    )}
                  </div>
                  <div className="pb-marker-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`icon-btn-sm ${isLooping ? 'looping' : ''}`}
                      onClick={() => toggleLoop(marker.id)}
                      title="Loop this section"
                    >
                      <Repeat size={14} />
                    </button>
                    <button
                      className="icon-btn-sm"
                      onClick={() => { setEditingMarker(marker.id); setEditNote(marker.note); }}
                      title="Edit label"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="icon-btn-sm danger"
                      onClick={() => deleteMarker(marker.id)}
                      title="Delete marker"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sortedMarkers.length === 0 && loaded && (
        <div className="pb-no-markers">No markers in this recording</div>
      )}
    </div>
  );
}
