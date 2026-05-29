export interface Slide {
  label: string;
  lines: string[];
}

export interface Song {
  presentation: string;
  arrangement: string;
  slides: Slide[];
}

export interface ServiceItem {
  id: string;
  type: string;
  icon: string;
  name: string;
  dur: string;
  durationSeconds: number | null;
  status: "done" | "active" | "next" | "upcoming";
}

export interface ConnectionRow {
  name: string;
  status: string;
  state: "ok" | "warn" | "err";
}

export interface ChatMsg {
  plat: "YT" | "FB";
  author: string;
  text: string;
  time: string;
}

export interface HealthConfig {
  label: string;
  color: string;
  bitrate: number;
  dropped: number;
  cpu: number;
  jit: number;
}

export const SONG: Song = {
  presentation: "Mercy Like A River",
  arrangement: "Sunday AM · Default",
  slides: [
    { label: "Intro", lines: [] },
    { label: "Verse 1", lines: ["I will sing of all You've done", "From the rising of the sun"] },
    { label: "Verse 2", lines: ["When the night is closing in", "You are faithful still, my friend"] },
    { label: "Pre-Chorus", lines: ["And I will not be afraid", "For Your love has lit the way"] },
    { label: "Chorus", lines: ["Your mercy flows like a river", "Deeper than the deepest sea"] },
    { label: "Chorus 2", lines: ["I am Yours and You are with me", "Now and through eternity"] },
    { label: "Bridge", lines: ["Oh the goodness, oh the grace", "Every morning, new again"] },
    { label: "Outro", lines: ["Mercy poured out over me"] },
  ],
};

export const SERVICE: ServiceItem[] = [
  { id: "sim-walk-in-loop",      type: "media",     icon: "▶",  name: "Walk-in Loop",                     dur: "10:00", durationSeconds: 600,  status: "done" },
  { id: "sim-welcome-song",      type: "song",      icon: "🎵", name: "Welcome — Morning Light",          dur: "4:30",  durationSeconds: 270,  status: "done" },
  { id: "sim-opening-prayer",    type: "prayer",    icon: "🙏", name: "Opening Prayer",                   dur: "2:00",  durationSeconds: 120,  status: "done" },
  { id: "sim-mercy-like-river",  type: "song",      icon: "🎵", name: "Mercy Like A River",               dur: "5:15",  durationSeconds: 315,  status: "active" },
  { id: "sim-great-is-lord",     type: "song",      icon: "🎵", name: "Great Is The Lord",                dur: "4:45",  durationSeconds: 285,  status: "next" },
  { id: "sim-ephesians-4",       type: "scripture", icon: "📖", name: "Scripture — Ephesians 4",          dur: "3:00",  durationSeconds: 180,  status: "upcoming" },
  { id: "sim-sermon-each-part",  type: "sermon",    icon: "🎤", name: "Sermon — Each Part Does Its Work", dur: "32:00", durationSeconds: 1920, status: "upcoming" },
  { id: "sim-response-song",     type: "song",      icon: "🎵", name: "Response — All My Days",           dur: "5:00",  durationSeconds: 300,  status: "upcoming" },
  { id: "sim-benediction",       type: "prayer",    icon: "🙏", name: "Benediction",                      dur: "1:30",  durationSeconds: 90,   status: "upcoming" },
  { id: "sim-announcements-loop", type: "media",     icon: "▶",  name: "Announcements Loop",               dur: "6:00",  durationSeconds: 360,  status: "upcoming" },
];

export const CONNECTIONS: ConnectionRow[] = [
  { name: "ProPresenter 7", status: "Linked",     state: "ok" },
  { name: "PCO Services",   status: "Synced",     state: "ok" },
  { name: "YouTube Live",   status: "Streaming",  state: "ok" },
  { name: "Facebook Live",  status: "Polling",    state: "warn" },
  { name: "X32 · Dante",   status: "Connected",  state: "ok" },
];

export const CHAT_SEED: ChatMsg[] = [
  { plat: "FB", author: "Daniel Okafor",  text: "The mix sounds incredible this morning", time: "10:18" },
  { plat: "YT", author: "GraceNotes_Mae", text: "Worshipping with you from Ohio",          time: "10:19" },
  { plat: "YT", author: "hillside_kid",   text: "Can we get cam 2 a touch brighter?",      time: "10:21" },
  { plat: "FB", author: "Ruth Alvarez",   text: "Lyrics are perfectly in time today",      time: "10:22" },
];

export const CHAT_SCRIPT: Omit<ChatMsg, "time">[] = [
  { plat: "YT", author: "northside_av",  text: "Stream looks rock solid 👏" },
  { plat: "FB", author: "Tom Becker",    text: "Praying for the service" },
  { plat: "YT", author: "mara_v",        text: "Audio dropped for a sec — back now" },
  { plat: "FB", author: "Joline P.",     text: "Love this song" },
  { plat: "YT", author: "deacon_ray",    text: "Lower third spelled the name wrong fyi" },
  { plat: "FB", author: "Sam Whitfield", text: "Sharing to our small group now" },
  { plat: "YT", author: "kayla.h",       text: "Bitrate held steady the whole set" },
  { plat: "FB", author: "Pastor Greg",   text: "Thank you booth team 🙏" },
];

export const HEALTH: { healthy: HealthConfig; degraded: HealthConfig; critical: HealthConfig } & Record<string, HealthConfig | undefined> = {
  healthy:  { label: "HEALTHY",  color: "#34d399", bitrate: 6050, dropped: 0.03, cpu: 47, jit: 150 },
  degraded: { label: "DEGRADED", color: "#f0b429", bitrate: 3820, dropped: 1.40, cpu: 79, jit: 360 },
  critical: { label: "CRITICAL", color: "#ff5c5c", bitrate: 1460, dropped: 6.10, cpu: 96, jit: 520 },
};

export const SLIDE_COUNTS = [6, 5, 1, 8, 7, 4, 22, 6, 1, 1];
