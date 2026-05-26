import { useState, useEffect, useCallback } from 'react';
import { Mic, Search, ChevronRight, Clock, Tag } from 'lucide-react';
import type { Recording, AppScreen } from '../types';
import { getAll, remove } from '../store/recordings';
import { deleteAudio } from '../store/db';

interface Props {
  onNavigate: (screen: AppScreen) => void;
  refreshKey: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - ts;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function HomeScreen({ onNavigate, refreshKey }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [query, setQuery] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const load = useCallback(() => setRecordings(getAll()), []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = query.trim()
    ? recordings.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.markers.some((m) => m.note.toLowerCase().includes(q))
        );
      })
    : recordings;

  const handleDelete = async (id: string) => {
    remove(id);
    await deleteAudio(id);
    load();
    setSwipedId(null);
  };

  const allTags = Array.from(
    new Set(recordings.flatMap((r) => r.markers.map((m) => m.note).filter(Boolean)))
  ).slice(0, 8);

  return (
    <div className="screen home-screen">
      <div className="home-header">
        <h1 className="home-title">Voice Memos</h1>
      </div>

      <div className="search-bar">
        <Search size={16} color="rgba(255,255,255,0.4)" />
        <input
          className="search-input"
          placeholder="Search recordings or labels…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')}>×</button>
        )}
      </div>

      {allTags.length > 0 && !query && (
        <div className="tag-chips">
          {allTags.map((tag) => (
            <button key={tag} className="tag-chip" onClick={() => setQuery(tag)}>
              <Tag size={11} />
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="recordings-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <Mic size={36} color="rgba(255,255,255,0.2)" />
            </div>
            <p className="empty-title">{query ? 'No results' : 'No recordings yet'}</p>
            <p className="empty-sub">{query ? 'Try a different search term' : 'Tap the button below to start recording'}</p>
          </div>
        )}
        {filtered.map((r) => (
          <div
            key={r.id}
            className={`recording-card ${swipedId === r.id ? 'swiped' : ''}`}
            onClick={() => swipedId === r.id ? setSwipedId(null) : onNavigate({ name: 'playback', id: r.id })}
          >
            <div className="card-main">
              <div className="card-info">
                <span className="card-title">{r.title}</span>
                <div className="card-meta">
                  <span className="card-date">
                    <Clock size={11} />
                    {formatDate(r.createdAt)} · {formatDuration(r.duration)}
                  </span>
                  {r.markers.length > 0 && (
                    <span className="card-markers">
                      <Tag size={11} />
                      {r.markers.length} marker{r.markers.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {r.markers.some((m) => m.note) && (
                  <div className="card-tags">
                    {r.markers.filter((m) => m.note).slice(0, 3).map((m) => (
                      <span key={m.id} className="card-tag">{m.note}</span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
            </div>
            <button
              className="card-delete"
              onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="home-fab-area">
        <button className="record-fab" onClick={() => onNavigate({ name: 'recording' })}>
          <Mic size={28} />
        </button>
      </div>
    </div>
  );
}
