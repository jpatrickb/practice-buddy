/** Mock song manifests, ADR-0005 shape (subset used by the UI). No audio files exist. */
export interface PartManifest {
  id: string; label: string; file: string; defaultGain: number;
  channels: number; order: number; kind: "accompaniment" | "voice";
}
export interface SongManifest {
  schemaVersion: 1; id: string; title: string; credits: string;
  durationSec: number; sampleRate: number; parts: PartManifest[];
}
export interface ChoirManifest { id: string; name: string; songs: string[] }

const part = (song: string, id: string, label: string, order: number, kind: PartManifest["kind"]): PartManifest => ({
  id, label, file: `audio/${song}/${id}.mock.m4a`, defaultGain: 1, channels: 1, order, kind,
});

export const SONGS: SongManifest[] = [
  {
    schemaVersion: 1, id: "candlelight-carol", title: "Candlelight Carol", credits: "John Rutter",
    durationSec: 213, sampleRate: 44100,
    parts: [
      part("candlelight-carol", "organ", "Organ", 0, "accompaniment"),
      part("candlelight-carol", "soprano", "Soprano", 1, "voice"),
      part("candlelight-carol", "alto", "Alto", 2, "voice"),
      part("candlelight-carol", "tenor", "Tenor", 3, "voice"),
      part("candlelight-carol", "baritone", "Baritone", 4, "voice"),
      part("candlelight-carol", "bass", "Bass", 5, "voice"),
    ],
  },
  {
    schemaVersion: 1, id: "example-duet", title: "Example Duet", credits: "Traditional, arr. Example",
    durationSec: 150, sampleRate: 44100,
    parts: [
      part("example-duet", "piano", "Piano", 0, "accompaniment"),
      part("example-duet", "part-1", "Part 1", 1, "voice"),
      part("example-duet", "part-2", "Part 2", 2, "voice"),
    ],
  },
];

export const CHOIR: ChoirManifest = {
  id: "oak-hills-3rd", name: "Oak Hills 3rd Ward Choir", songs: SONGS.map((s) => s.id),
};

export const sortedParts = (s: SongManifest) => [...s.parts].sort((a, b) => a.order - b.order);
/** Parts a singer can choose as "their part". */
export const singable = (s: SongManifest) => sortedParts(s).filter((p) => p.kind === "voice");
