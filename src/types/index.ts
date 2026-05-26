export interface Marker {
  id: string;
  timestamp: number; // seconds from recording start
  note: string;
}

export interface Recording {
  id: string;
  title: string;
  duration: number; // seconds
  createdAt: number; // unix ms
  updatedAt: number;
  markers: Marker[];
  mimeType: string;
}

export type AppScreen =
  | { name: 'home' }
  | { name: 'recording' }
  | { name: 'playback'; id: string };
