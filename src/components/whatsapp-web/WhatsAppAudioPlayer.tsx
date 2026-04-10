import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppAudioPlayerProps {
  src: string;
  isMe?: boolean;
}

const SPEED_OPTIONS = [1, 1.5, 2, 0.5];

// Generate pseudo-random waveform bars from a seed string
function generateWaveform(seed: string, barCount: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    hash = (hash * 16807 + 12345) & 0x7fffffff;
    const val = 0.15 + (hash % 100) / 100 * 0.85;
    bars.push(val);
  }
  return bars;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WhatsAppAudioPlayer({ src, isMe = false }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [waveform] = useState(() => generateWaveform(src, 40));
  const rafRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    setProgress(pct);
    setCurrentTime(audio.currentTime);
    if (!audio.paused) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onPlay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateProgress);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const container = waveformRef.current;
    if (!audio || !container || !audio.duration) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
    setCurrentTime(audio.currentTime);
  };

  const playedBars = Math.floor((progress / 100) * waveform.length);

  return (
    <div className="flex items-center gap-2 min-w-[240px] max-w-[320px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isMe
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-[hsl(var(--whatsapp))]/15 hover:bg-[hsl(var(--whatsapp))]/25 text-[hsl(var(--whatsapp))]"
        )}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          className="flex items-end gap-[2px] h-[28px] cursor-pointer py-1"
        >
          {waveform.map((h, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full min-w-[2px] max-w-[4px] transition-colors duration-150",
                i < playedBars
                  ? isMe
                    ? "bg-white/90"
                    : "bg-[hsl(var(--whatsapp))]"
                  : isMe
                    ? "bg-white/30"
                    : "bg-muted-foreground/25"
              )}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs tabular-nums",
            isMe ? "text-white/70" : "text-muted-foreground"
          )}>
            {isPlaying ? formatTime(currentTime) : formatTime(duration)}
          </span>

          {/* Speed control */}
          <button
            onClick={cycleSpeed}
            className={cn(
              "text-xs font-bold px-1.5 py-0.5 rounded-full transition-colors",
              isMe
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            {speed}×
          </button>
        </div>
      </div>

      {/* Mic icon */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        isMe ? "bg-white/15" : "bg-[hsl(var(--whatsapp))]/10"
      )}>
        <Mic className={cn(
          "w-4 h-4",
          isMe ? "text-white/70" : "text-[hsl(var(--whatsapp))]/70"
        )} />
      </div>
    </div>
  );
}
