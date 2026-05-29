import { useState } from "react";
import { Electroview } from "electrobun/view";
import type { MixxxRPC } from "../shared/types";

const rpc = Electroview.defineRPC<MixxxRPC>({
  maxRequestTime: Infinity,
  handlers: { requests: {}, messages: {} },
});
const electroview = new Electroview({ rpc });
import {
  Play,
  SkipBack,
  SkipForward,
  Search,
  Plus,
  Disc3,
  Piano,

  Music2,
  CheckCircle2,

} from "lucide-react";
import { Button } from "@/components/ui/button";

const TRACKS = [
  { id: 1, cover: "bg-gray-200", artist: "Chet Faker", title: "Gold", tempo: 140, key: "2A", keyColor: "bg-key-green text-black", energy: 5, cue: 8, status: "Completed" },
  { id: 2, cover: "bg-blue-500", artist: "Porter Robinson", title: "Look at the Sky", tempo: 115, key: "2B", keyColor: "bg-key-green text-black", energy: 6, cue: 8, status: "Completed" },
  { id: 3, cover: "bg-orange-400", artist: "Gryffin & Illenium", title: "Feel Good [feat. Daya]", tempo: 138, key: "10B", keyColor: "bg-key-blue text-black", energy: 7, cue: 8, status: "Completed" },
  { id: 4, cover: "bg-purple-600", artist: "Dua Lipa", title: "Don't Start Now", tempo: 124, key: "10A", keyColor: "bg-key-blue text-black", energy: 7, cue: 8, status: "Completed" },
  { id: 5, cover: "bg-cyan-500", artist: "Juice WRLD", title: "Lucid Dreams", tempo: 112, key: "11A", keyColor: "bg-key-cyan text-black", energy: 5, cue: 8, status: "Completed" },
  { id: 6, cover: "bg-red-500", artist: "Travis Scott", title: "HIGHEST IN THE ROOM", tempo: 153, key: "7A", keyColor: "bg-key-pink text-black", energy: 6, cue: 8, status: "Completed" },
  { id: 7, cover: "bg-indigo-600", artist: "David Guetta x MORTEN", title: "Kill Me Slow", tempo: 126, key: "11A", keyColor: "bg-key-cyan text-black", energy: 8, cue: 8, status: "Completed" },
  { id: 8, cover: "bg-pink-500", artist: "Machine Gun Kelly", title: "bloody valentine", tempo: 80, key: "11A", keyColor: "bg-key-cyan text-black", energy: 7, cue: 8, status: "Completed" },
  { id: 9, cover: "bg-yellow-500", artist: "Sofi Tukker & Mahmut Orhan", title: "Swing (Mahmut Orhan Remix)", tempo: 118, key: "4A", keyColor: "bg-key-orange text-black", energy: 5, cue: 8, status: "Completed" },
  { id: 10, cover: "bg-zinc-800", artist: "Daft Punk", title: "Digital Love", tempo: 125, key: "11B", keyColor: "bg-key-cyan text-black", energy: 6, cue: 6, status: "Completed" },
  { id: 11, cover: "bg-slate-700", artist: "Masked Wolf", title: "Astronaut In The Ocean", tempo: 150, key: "11A", keyColor: "bg-key-cyan text-black", energy: 6, cue: 7, status: "Completed" },
  { id: 12, cover: "bg-amber-600", artist: "Diplo & Sonny Fodera", title: "Turn Back Time", tempo: 124, key: "3A", keyColor: "bg-key-lightgreen text-black", energy: 7, cue: 6, status: "Completed" },
];

function App() {
  const [activeTab, setActiveTab] = useState("collection");

  async function handleAddTracks() {
    const contents = await electroview.rpc!.request.getContents();
    for (const content of contents) {
      console.log(content);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans selection:bg-primary/30">

      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-card border-r border-border shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <Disc3 size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight">MIXXXA</span>
        </div>

        {/* Camelot Wheel Placeholder */}
        <div className="px-6 py-4 flex justify-center">
          <div className="relative w-48 h-48 rounded-full border-8 border-muted flex items-center justify-center shadow-[0_0_30px_rgba(163,230,53,0.1)]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent/20 to-primary/20 opacity-50 blur-xl"></div>
            <div className="text-center z-10">
              <span className="text-2xl font-black text-primary">11B</span>
              <div className="text-xs text-muted-foreground mt-1">A Major</div>
            </div>

            {/* Mock wheel segments (simplified visual representation) */}
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50 rotate-45"></div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50 -rotate-45"></div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50 rotate-90"></div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50"></div>
          </div>
        </div>

        <div className="px-6 py-4">
          <Button onClick={handleAddTracks} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
            ADD TRACKS
          </Button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-md cursor-pointer transition-colors">
            <span>Analysis Queue</span>
            <span className="text-xs">Done</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-sm font-medium bg-muted/50 text-foreground rounded-md cursor-pointer border-l-2 border-primary">
            <span>My Collection</span>
            <div className="w-5 h-5 bg-primary text-primary-foreground flex items-center justify-center rounded text-xs font-bold">
              <Plus size={14} />
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-md cursor-pointer transition-colors">
            <span>Improve Tracks</span>
            <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded">8</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-md cursor-pointer transition-colors">
            <span>Recently Added</span>
            <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded">12</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header Tabs */}
        <header className="h-16 flex items-center justify-between border-b border-border px-6 bg-card shrink-0">
          <div className="flex h-full">
            <button
              onClick={() => setActiveTab("collection")}
              className={`px-6 h-full font-semibold text-sm border-b-2 transition-colors ${activeTab === "collection" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              COLLECTION
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`px-6 h-full font-semibold text-sm border-b-2 transition-colors ${activeTab === "tags" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              EDIT TAGS
            </button>
            <button
              onClick={() => setActiveTab("personalize")}
              className={`px-6 h-full font-semibold text-sm border-b-2 transition-colors ${activeTab === "personalize" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              PERSONALIZE
            </button>
          </div>

          <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <button className="hover:text-foreground transition-colors">TUTORIALS</button>
            <button className="hover:text-foreground transition-colors">SOFTWARE</button>
          </div>
        </header>

        {/* Player Section */}
        <section className="p-6 border-b border-border bg-card/50 flex flex-col gap-6 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <SkipBack size={20} />
              </button>
              <button className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                <Play size={24} className="ml-1" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <SkipForward size={20} />
              </button>
            </div>

            <div className="flex-1 h-16 bg-muted/30 rounded-lg relative overflow-hidden flex items-center px-4 border border-border/50">
              {/* Mock Waveform bars */}
              <div className="absolute inset-0 flex items-center gap-[2px] opacity-60 px-2">
                {Array.from({ length: 100 }).map((_, i) => {
                  const height = 10 + Math.random() * 80;
                  const isPlayed = i < 30;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${isPlayed ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>

              {/* Cue markers */}
              <div className="absolute top-0 left-[15%] h-full w-px bg-accent z-10 shadow-[0_0_10px_var(--accent)]">
                <div className="bg-accent text-accent-foreground text-[10px] font-bold px-1 py-0.5 rounded-b-sm absolute top-0 -translate-x-1/2 whitespace-nowrap">
                  CUE 1
                </div>
              </div>
              <div className="absolute top-0 left-[45%] h-full w-px bg-accent z-10 shadow-[0_0_10px_var(--accent)]">
                <div className="bg-accent text-accent-foreground text-[10px] font-bold px-1 py-0.5 rounded-b-sm absolute top-0 -translate-x-1/2 whitespace-nowrap">
                  CUE 2
                </div>
              </div>

              <div className="absolute right-4 bottom-2 text-xs font-mono text-muted-foreground z-10 bg-background/80 px-1.5 py-0.5 rounded">
                00:00 / 04:00
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-light tracking-tight mb-2">Daft Punk - Digital Love</h2>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Key</span>
                  <span className="bg-key-cyan text-black px-2 py-0.5 rounded text-xs font-bold">11B</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Energy</span>
                  <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium border border-border">6</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">BPM</span>
                  <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium border border-border">125</span>
                </div>
                <div className="flex items-center gap-3 ml-4 border-l border-border pl-6">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Cue Points</span>
                  <div className="flex items-center gap-1">
                    <button className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 text-muted-foreground transition-colors"><SkipBack size={14} /></button>
                    <button className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 text-muted-foreground transition-colors"><Play size={14} /></button>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-dashed text-muted-foreground hover:text-foreground">ADD CUE</Button>
                </div>
                <div className="flex items-center gap-2 ml-4 border-l border-border pl-6">
                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Virtual Piano</span>
                  <button className="p-1 hover:text-primary transition-colors"><Piano size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Track List */}
        <section className="flex-1 flex flex-col min-h-0 bg-background">
          <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search your Analysis Queue"
                className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {TRACKS.length} TRACKS
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-background z-10 shadow-sm border-b border-border">
                <tr className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Cover Art</th>
                  <th className="px-6 py-4 font-medium">Artist</th>
                  <th className="px-6 py-4 font-medium w-full">Title</th>
                  <th className="px-6 py-4 font-medium text-right">Tempo</th>
                  <th className="px-6 py-4 font-medium">Key Result</th>
                  <th className="px-6 py-4 font-medium text-center">Energy</th>
                  <th className="px-6 py-4 font-medium text-center">Cue Points</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {TRACKS.map((track) => (
                  <tr key={track.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-2.5">
                      <div className={`w-12 h-8 rounded-sm ${track.cover} shadow-sm border border-border/50 flex items-center justify-center`}>
                        <Music2 size={14} className="text-background/50" />
                      </div>
                    </td>
                    <td className="px-6 py-2.5 font-medium">{track.artist}</td>
                    <td className="px-6 py-2.5 text-muted-foreground group-hover:text-foreground transition-colors">{track.title}</td>
                    <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">{track.tempo}</td>
                    <td className="px-6 py-2.5">
                      <span className={`${track.keyColor} px-2 py-0.5 rounded text-xs font-bold inline-block min-w-[36px] text-center shadow-sm`}>
                        {track.key}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-center text-muted-foreground font-mono">{track.energy}</td>
                    <td className="px-6 py-2.5 text-center text-muted-foreground font-mono">{track.cue}</td>
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 size={14} className="text-primary/70" />
                        <span className="text-xs">{track.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <div className="flex justify-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50"></div>
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50"></div>
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/50"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
