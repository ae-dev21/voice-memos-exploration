import { useState, useCallback } from 'react';
import type { AppScreen } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { RecordingScreen } from './screens/RecordingScreen';
import { PlaybackScreen } from './screens/PlaybackScreen';
import './index.css';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'home' });
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback((s: AppScreen) => setScreen(s), []);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="app">
      {screen.name === 'home' && (
        <HomeScreen onNavigate={navigate} refreshKey={refreshKey} />
      )}
      {screen.name === 'recording' && (
        <RecordingScreen onNavigate={navigate} onRecordingSaved={refresh} />
      )}
      {screen.name === 'playback' && (
        <PlaybackScreen
          recordingId={screen.id}
          onNavigate={navigate}
          onRecordingsChanged={refresh}
        />
      )}
    </div>
  );
}
