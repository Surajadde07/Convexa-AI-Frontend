import { useEffect, useRef, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

/**
 * MiniAudioPlayer — inline play/pause button for use in tables/lists.
 *
 * Props:
 *   filePath  — the stored path e.g. "/audio/recording.mp3"
 *   playingId — id of the call currently playing (lifted state)
 *   callId    — this call's id
 *   onPlay    — (callId) => void  — called when this player starts
 *   onStop    — ()       => void  — called when this player stops/ends
 */
export default function MiniAudioPlayer({ filePath, playingId, callId, onPlay, onStop }) {
    const audioRef = useRef(null);
    const isPlaying = playingId === callId;

    // When another call starts playing, pause this one
    useEffect(() => {
        if (!isPlaying && audioRef.current) {
            audioRef.current.pause();
        }
    }, [isPlaying]);

    const toggle = (e) => {
        e.stopPropagation(); // don't bubble to row select
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            onStop?.();
        } else {
            audio.play().catch(() => {});
            onPlay?.(callId);
        }
    };

    const handleEnded = () => onStop?.();

    if (!filePath) return null;

    const src = `${BASE_URL}${filePath}`;

    return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <audio ref={audioRef} src={src} onEnded={handleEnded} preload="none" />
            <button
                onClick={toggle}
                title={isPlaying ? "Pause" : "Play audio"}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                    border text-sm
                    ${isPlaying
                        ? "bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20"
                    }`}>
                {isPlaying ? "⏸" : "▶"}
            </button>
            {isPlaying && (
                <span className="flex gap-0.5 items-end h-3">
                    {[0, 1, 2].map(i => (
                        <span key={i}
                            className="w-0.5 rounded-full bg-violet-400"
                            style={{
                                height: `${40 + i * 20}%`,
                                animation: `audioBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                            }} />
                    ))}
                </span>
            )}
            <style>{`
                @keyframes audioBar {
                    from { transform: scaleY(0.4); }
                    to   { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
}
