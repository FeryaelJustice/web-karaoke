import React, { useState, useEffect, useRef } from "react";
import {
    Play,
    Pause,
    Languages,
    Sparkles,
    BookOpen,
    Search,
    Loader2,
    ChevronRight,
    UploadCloud,
    Music,
    FileText,
    CheckCircle2,
    Volume2,
    VolumeX,
    FastForward,
    Rewind,
    Gauge,
    FileUp,
    AlertCircle,
    WifiOff,
    PenTool,
    Download,
    ArrowUpCircle,
    XCircle,
    ArrowRight,
} from "lucide-react";
import {
    analyzeLyricsChunk,
    hasGeminiApiKey,
    isRateLimitError,
} from "@/lib/gemini";

const App = () => {
    // Estado de Audio y Archivo
    const [audioFile, setAudioFile] = useState(null);
    const [audioUrl, setAudioUrl] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [syncOffset, setSyncOffset] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);

    // Estado de Drag & Drop
    const [isDraggingAudio, setIsDraggingAudio] = useState(false);
    const [isDraggingLrc, setIsDraggingLrc] = useState(false);

    // Estado de API LRCLIB y Archivos LRC
    const [searchQuery, setSearchQuery] = useState("Dua Lipa Houdini");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [parsedLyrics, setParsedLyrics] = useState([]);
    const [isJapaneseLyrics, setIsJapaneseLyrics] = useState(false);

    // Estado de Análisis IA y Paginación Manual
    const [analysis, setAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [linesProcessed, setLinesProcessed] = useState(0);
    const [isWaitingToContinue, setIsWaitingToContinue] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisError, setAnalysisError] = useState(null);
    const [activeTab, setActiveTab] = useState("dictionary");

    // Estado de red
    const [isOnline, setIsOnline] = useState(true);

    // Estado del Creador LRC
    const [creatorRawText, setCreatorRawText] = useState("");
    const [creatorLines, setCreatorLines] = useState([]);
    const [creatorCurrentIndex, setCreatorCurrentIndex] = useState(0);

    const audioRef = useRef(null);
    const lrcInputRef = useRef(null);
    const currentYear = new Date().getFullYear();
    const MAX_LINES_PER_CHUNK = 6;
    const MAX_CHARS_PER_CHUNK = 900;
    const INTER_CHUNK_DELAY_MS = 1200;
    const MAX_CHUNK_RETRIES = 8;

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const resetAnalysisState = () => {
        setAnalysis(null);
        setAnalysisError(null);
        setAnalysisProgress(0);
        setLinesProcessed(0);
        setIsWaitingToContinue(false);
    };

    const processAudioFile = (file) => {
        if (file && file.type.startsWith("audio/")) {
            const url = URL.createObjectURL(file);
            setAudioFile(file);
            setAudioUrl(url);
            resetAnalysisState();
            setSyncOffset(0);
        }
    };

    const handleAudioUpload = (e) => processAudioFile(e.target.files[0]);
    const onAudioDragOver = (e) => {
        e.preventDefault();
        setIsDraggingAudio(true);
    };
    const onAudioDragLeave = (e) => {
        e.preventDefault();
        setIsDraggingAudio(false);
    };
    const onAudioDrop = (e) => {
        e.preventDefault();
        setIsDraggingAudio(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processAudioFile(e.dataTransfer.files[0]);
        }
    };

    const processLrcFile = (file) => {
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                const lyrics = parseLRC(content);

                if (lyrics.length > 0) {
                    setParsedLyrics(lyrics);
                    setSelectedTrack({
                        trackName: file.name.replace(/\.[^/.]+$/, ""),
                        artistName: "Archivo Local",
                    });
                    setSearchResults([]);
                    resetAnalysisState();
                    setSyncOffset(0);

                    const fullText = lyrics.map((l) => l.text).join(" ");
                    setIsJapaneseLyrics(detectJapanese(fullText));
                } else {
                    console.warn(
                        "El archivo no contiene un formato LRC válido con marcas de tiempo.",
                    );
                }
            };
            reader.readAsText(file);
        }
        if (lrcInputRef.current) lrcInputRef.current.value = "";
    };

    const handleLrcUpload = (e) => processLrcFile(e.target.files[0]);
    const onLrcDragOver = (e) => {
        e.preventDefault();
        setIsDraggingLrc(true);
    };
    const onLrcDragLeave = (e) => {
        e.preventDefault();
        setIsDraggingLrc(false);
    };
    const onLrcDrop = (e) => {
        e.preventDefault();
        setIsDraggingLrc(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processLrcFile(e.dataTransfer.files[0]);
        }
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };

    const handleSeek = (timeInSeconds) => {
        if (audioRef.current) {
            audioRef.current.currentTime = timeInSeconds;
            setCurrentTime(timeInSeconds);
            if (!isPlaying) {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            const newMutedState = !isMuted;
            audioRef.current.muted = newMutedState;
            setIsMuted(newMutedState);
            if (newMutedState) setVolume(0);
            else {
                setVolume(1);
                audioRef.current.volume = 1;
            }
        }
    };

    const adjustOffset = (amount) =>
        setSyncOffset((prev) => parseFloat((prev + amount).toFixed(2)));

    const handlePlaybackRate = (e) => {
        const rate = parseFloat(e.target.value);
        setPlaybackRate(rate);
        if (audioRef.current) audioRef.current.playbackRate = rate;
    };

    const searchLyrics = async () => {
        if (!searchQuery.trim() || !isOnline) return;
        setIsSearching(true);
        setSearchResults([]);
        setSelectedTrack(null);
        setParsedLyrics([]);
        setSyncOffset(0);
        setIsJapaneseLyrics(false);
        resetAnalysisState();

        try {
            const response = await fetch(
                `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`,
            );
            const data = await response.json();
            const tracksWithSync = data.filter((track) => track.syncedLyrics);
            setSearchResults(tracksWithSync.slice(0, 5));
        } catch (error) {
            console.warn("Error buscando letras:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const parseLRC = (lrcString) => {
        const lines = lrcString.split("\n");
        const parsed = [];
        const timeRegEx = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        lines.forEach((line) => {
            const match = timeRegEx.exec(line);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const milliseconds =
                    parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
                const timeInSeconds =
                    minutes * 60 + seconds + milliseconds / 1000;
                const text = line.replace(timeRegEx, "").trim();

                if (text) {
                    parsed.push({ time: timeInSeconds, text });
                }
            }
        });
        return parsed;
    };

    const detectJapanese = (text) =>
        /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);

    const selectTrack = (track) => {
        setSelectedTrack(track);
        const lyrics = parseLRC(track.syncedLyrics);
        setParsedLyrics(lyrics);
        setSearchResults([]);
        resetAnalysisState();

        const fullText = lyrics.map((l) => l.text).join(" ");
        setIsJapaneseLyrics(detectJapanese(fullText));
    };

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const buildFallbackAnalysis = (chunkLines, message) => ({
        karaoke_pronunciation: chunkLines.map(() => "---"),
        word_breakdown: chunkLines.map((line) => ({
            line_index: line.originalIndex,
            original: line.text,
            pronunciation: "---",
            significado: message,
            analisis_gramatical: "N/A",
        })),
        sentence_analysis: chunkLines.map((line) => ({
            line_index: line.originalIndex,
            original: line.text,
            pronunciation: "---",
            traduccion_literal: message,
            explicacion_natural: message,
            notas_construccion: "El bloque no pudo procesarse automaticamente.",
        })),
    });

    const getChunkFromIndex = (startIndex) => {
        const chunk = [];
        let currentChars = 0;

        for (let index = startIndex; index < parsedLyrics.length; index += 1) {
            const line = parsedLyrics[index];
            const estimatedChars = line.text.length + 24;
            const wouldOverflow =
                chunk.length > 0 &&
                (chunk.length >= MAX_LINES_PER_CHUNK ||
                    currentChars + estimatedChars > MAX_CHARS_PER_CHUNK);

            if (wouldOverflow) break;

            chunk.push({
                ...line,
                originalIndex: index,
            });
            currentChars += estimatedChars;
        }

        return chunk;
    };

    const analyzeChunkWithRetry = async (chunkLines) => {
        let attempt = 0;
        let nextDelayMs = INTER_CHUNK_DELAY_MS;

        while (attempt < MAX_CHUNK_RETRIES) {
            try {
                return await analyzeLyricsChunk(chunkLines);
            } catch (error) {
                attempt += 1;

                if (isRateLimitError(error)) {
                    const retryDelayMs = Math.min(
                        60000,
                        Math.round(nextDelayMs * (1 + Math.random() * 0.25)),
                    );
                    setAnalysisError(
                        `Gemini esta aplicando un limite temporal. Reintentando automaticamente en ${Math.ceil(retryDelayMs / 1000)}s.`,
                    );
                    await delay(retryDelayMs);
                    nextDelayMs *= 2;
                    continue;
                }

                if (attempt < 3) {
                    await delay(nextDelayMs);
                    nextDelayMs *= 2;
                    continue;
                }

                throw error;
            }
        }

        return buildFallbackAnalysis(
            chunkLines,
            "Gemini no acepto mas solicitudes para este bloque.",
        );
    };

    const processNextChunk = async () => {
        if (parsedLyrics.length === 0 || !isOnline) return;
        if (!hasGeminiApiKey()) {
            setAnalysisError(
                "Configura VITE_GEMINI_API_KEY para usar el analisis IA.",
            );
            return;
        }

        setIsAnalyzing(true);
        setIsWaitingToContinue(false);
        setAnalysisError(null);

        let nextIndex = linesProcessed;
        let lyricsState = [...parsedLyrics];
        let currentAnalysis = analysis
            ? {
                  word_breakdown: [...analysis.word_breakdown],
                  sentence_analysis: [...analysis.sentence_analysis],
              }
            : {
                  word_breakdown: [],
                  sentence_analysis: [],
              };

        try {
            while (nextIndex < parsedLyrics.length) {
                const chunkLines = getChunkFromIndex(nextIndex);
                if (chunkLines.length === 0) break;

                const result = await analyzeChunkWithRetry(chunkLines);

                if (result.karaoke_pronunciation) {
                    result.karaoke_pronunciation.forEach(
                        (pronunciation, index) => {
                            const line = chunkLines[index];
                            if (line && lyricsState[line.originalIndex]) {
                                lyricsState[line.originalIndex] = {
                                    ...lyricsState[line.originalIndex],
                                    pronunciation,
                                };
                            }
                        },
                    );
                }

                if (result.word_breakdown)
                    currentAnalysis.word_breakdown.push(
                        ...result.word_breakdown,
                    );
                if (result.sentence_analysis)
                    currentAnalysis.sentence_analysis.push(
                        ...result.sentence_analysis,
                    );

                nextIndex += chunkLines.length;
                const progress = Math.round(
                    (nextIndex / parsedLyrics.length) * 100,
                );

                setParsedLyrics([...lyricsState]);
                setAnalysis({ ...currentAnalysis });
                setLinesProcessed(nextIndex);
                setAnalysisProgress(progress);
                setAnalysisError(null);

                if (nextIndex < parsedLyrics.length) {
                    await delay(INTER_CHUNK_DELAY_MS);
                }
            }
        } catch (error) {
            console.warn("Error en procesamiento automatico:", error);
            setIsWaitingToContinue(true);
            setAnalysisError(
                "Se detuvo el analisis de Gemini. Pulsa Continuar para reanudar desde el ultimo bloque pendiente.",
            );
        } finally {
            setIsAnalyzing(false);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const effectiveTime = currentTime - syncOffset;
    const currentLineIndex = parsedLyrics.findIndex((line, idx) => {
        const nextTime = parsedLyrics[idx + 1]
            ? parsedLyrics[idx + 1].time
            : duration || Infinity;
        return effectiveTime >= line.time && effectiveTime < nextTime;
    });

    useEffect(() => {
        if (currentLineIndex >= 0) {
            const karaokeEl = document.getElementById(
                `karaoke-line-${currentLineIndex}`,
            );
            if (karaokeEl)
                karaokeEl.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });

            if (activeTab === "dictionary") {
                const dictEl = document.querySelector(
                    `[data-dict-line="${currentLineIndex}"]`,
                );
                if (dictEl)
                    dictEl.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
            } else if (activeTab === "sentences") {
                const sentenceEl = document.querySelector(
                    `[data-sentence-line="${currentLineIndex}"]`,
                );
                if (sentenceEl)
                    sentenceEl.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
            }
        }
    }, [currentLineIndex, activeTab]);

    const handleCreatorTextChange = (e) => {
        const text = e.target.value;
        setCreatorRawText(text);
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        setCreatorLines(lines.map((l) => ({ text: l, time: null })));
        setCreatorCurrentIndex(0);
    };

    const stampCurrentTime = () => {
        if (!audioFile) {
            alert("Para sincronizar, sube un audio primero en el Paso 1.");
            return;
        }
        if (creatorCurrentIndex < creatorLines.length) {
            const newLines = [...creatorLines];
            newLines[creatorCurrentIndex].time = currentTime;
            setCreatorLines(newLines);
            setCreatorCurrentIndex(creatorCurrentIndex + 1);
        }
    };

    const clearStamp = (index) => {
        const newLines = [...creatorLines];
        newLines[index].time = null;
        setCreatorLines(newLines);
        if (index < creatorCurrentIndex) {
            setCreatorCurrentIndex(index);
        }
    };

    const generateLrcString = () => {
        return creatorLines
            .filter((l) => l.time !== null)
            .map((l) => {
                const m = Math.floor(l.time / 60)
                    .toString()
                    .padStart(2, "0");
                const s = Math.floor(l.time % 60)
                    .toString()
                    .padStart(2, "0");
                const ms = Math.floor((l.time % 1) * 100)
                    .toString()
                    .padStart(2, "0");
                return `[${m}:${s}.${ms}] ${l.text}`;
            })
            .join("\n");
    };

    const downloadLrcFile = () => {
        const lrcStr = generateLrcString();
        if (!lrcStr) return;
        const blob = new Blob([lrcStr], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${audioFile ? audioFile.name.replace(/\.[^/.]+$/, "") : "letras-creadas"}.lrc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadCreatorToPlayer = () => {
        const lrcStr = generateLrcString();
        if (!lrcStr) return;
        const lyrics = parseLRC(lrcStr);
        setParsedLyrics(lyrics);
        setSelectedTrack({
            trackName: "Letra Manual (Creada)",
            artistName: "Usuario",
        });
        setSearchResults([]);
        resetAnalysisState();

        const fullText = lyrics.map((l) => l.text).join(" ");
        setIsJapaneseLyrics(detectJapanese(fullText));

        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 lg:p-8 font-sans selection:bg-blue-500/30">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* HEADER */}
                <header className="flex flex-col md:flex-row items-center justify-between bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-900/50">
                            <Languages className="text-white w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
                                LingoKaraoke Master
                            </h1>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
                                Estudio de Idiomas Universal con LRC Sync
                            </p>
                        </div>
                    </div>
                    {!isOnline && (
                        <div className="flex items-center gap-2 bg-red-900/40 text-red-400 px-4 py-2 rounded-xl border border-red-500/30 mt-4 md:mt-0">
                            <WifiOff className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                Sin Conexión a Internet
                            </span>
                        </div>
                    )}
                </header>

                {/* CONTROLES PRINCIPALES */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Panel 1: Carga de Audio */}
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex flex-col justify-center relative">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs">
                                1
                            </span>
                            Fuente de Audio Local
                        </h2>

                        {!audioFile ? (
                            <label
                                onDragOver={onAudioDragOver}
                                onDragLeave={onAudioDragLeave}
                                onDrop={onAudioDrop}
                                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all group ${isDraggingAudio ? "border-blue-500 bg-blue-500/10" : "border-slate-600 hover:bg-slate-700/50"}`}
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                                    <UploadCloud
                                        className={`w-8 h-8 mb-3 transition-colors ${isDraggingAudio ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400"}`}
                                    />
                                    <p className="mb-2 text-sm text-slate-400">
                                        <span className="font-semibold text-white">
                                            Haz clic para subir
                                        </span>{" "}
                                        o arrastra tu archivo aquí
                                    </p>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">
                                        Formatos: FLAC, MP3, WAV, M4A
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={handleAudioUpload}
                                />
                            </label>
                        ) : (
                            <label
                                onDragOver={onAudioDragOver}
                                onDragLeave={onAudioDragLeave}
                                onDrop={onAudioDrop}
                                className={`bg-slate-900 p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${isDraggingAudio ? "border-blue-500 bg-blue-900/20" : "border-slate-700 hover:border-slate-600"}`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden pointer-events-none">
                                    <div className="bg-green-500/20 p-2 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    </div>
                                    <span className="font-medium text-sm truncate">
                                        {audioFile.name}
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest pointer-events-none">
                                    Cambiar (O Arrastrar)
                                </span>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={handleAudioUpload}
                                />
                            </label>
                        )}

                        {audioUrl && (
                            <div className="mt-4 bg-slate-900 p-4 rounded-2xl border border-slate-700 flex flex-col gap-4">
                                <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={(e) => {
                                        setDuration(e.target.duration);
                                        e.target.playbackRate = playbackRate;
                                    }}
                                    onEnded={() => setIsPlaying(false)}
                                />

                                {/* Timeline y Play */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={togglePlay}
                                        className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex-shrink-0"
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-5 h-5" />
                                        ) : (
                                            <Play className="w-5 h-5 ml-0.5" />
                                        )}
                                    </button>

                                    <div className="flex-grow flex items-center gap-3 text-xs font-mono text-slate-400">
                                        <span>{formatTime(currentTime)}</span>
                                        <div
                                            className="h-3 flex-grow bg-slate-800 rounded-full overflow-hidden relative cursor-pointer"
                                            onClick={(e) => {
                                                const rect =
                                                    e.currentTarget.getBoundingClientRect();
                                                const percent =
                                                    (e.clientX - rect.left) /
                                                    rect.width;
                                                handleSeek(percent * duration);
                                            }}
                                        >
                                            <div
                                                className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-75"
                                                style={{
                                                    width: `${(duration > 0 ? currentTime / duration : 0) * 100}%`,
                                                }}
                                            ></div>
                                        </div>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                {/* Controles Expandidos */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                                    {/* Volumen */}
                                    <div className="flex items-center gap-2 min-w-[120px] flex-grow sm:flex-grow-0">
                                        <button
                                            onClick={toggleMute}
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            {isMuted || volume === 0 ? (
                                                <VolumeX className="w-4 h-4" />
                                            ) : (
                                                <Volume2 className="w-4 h-4" />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={volume}
                                            onChange={handleVolumeChange}
                                            className="flex-grow h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>

                                    {/* Velocidad y Offset */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                                            <Gauge className="w-3 h-3 text-slate-400" />
                                            <select
                                                value={playbackRate}
                                                onChange={handlePlaybackRate}
                                                className="bg-transparent text-xs font-bold text-blue-400 border-none outline-none cursor-pointer"
                                            >
                                                <option value="0.5">
                                                    0.5x
                                                </option>
                                                <option value="1">1.0x</option>
                                                <option value="2">2.0x</option>
                                                <option value="3">3.0x</option>
                                                <option value="4">4.0x</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 ml-2 mr-1">
                                                Sync:
                                            </span>
                                            <button
                                                onClick={() =>
                                                    adjustOffset(-0.5)
                                                }
                                                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                                                title="Adelantar letra 0.5s"
                                            >
                                                <Rewind className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs font-mono w-10 text-center font-bold text-blue-400">
                                                {syncOffset > 0 ? "+" : ""}
                                                {syncOffset.toFixed(1)}s
                                            </span>
                                            <button
                                                onClick={() =>
                                                    adjustOffset(0.5)
                                                }
                                                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                                                title="Atrasar letra 0.5s"
                                            >
                                                <FastForward className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel 2: Sincronización LRC */}
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex flex-col relative">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs">
                                2
                            </span>
                            Sincronización LRC
                        </h2>

                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" &&
                                    isOnline &&
                                    searchLyrics()
                                }
                                disabled={!isOnline}
                                placeholder={
                                    isOnline
                                        ? "Buscar online (LRCLIB)..."
                                        : "Búsqueda deshabilitada (Sin conexión)"
                                }
                                className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={searchLyrics}
                                    disabled={isSearching || !isOnline}
                                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center min-w-[3rem]"
                                >
                                    {isSearching ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Search className="w-5 h-5" />
                                    )}
                                </button>

                                <label
                                    onDragOver={onLrcDragOver}
                                    onDragLeave={onLrcDragLeave}
                                    onDrop={onLrcDrop}
                                    className={`relative flex items-center justify-center border transition-all rounded-xl px-4 py-3 cursor-pointer ${isDraggingLrc ? "bg-blue-900/40 border-blue-500 text-blue-400" : "bg-slate-900 border-slate-700 hover:border-blue-500 text-slate-400 hover:text-blue-400"}`}
                                    title="Subir o soltar archivo LRC local"
                                >
                                    <FileUp className="w-5 h-5 pointer-events-none" />
                                    <input
                                        type="file"
                                        accept=".lrc,.txt"
                                        ref={lrcInputRef}
                                        onChange={handleLrcUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden mb-4 flex-grow overflow-y-auto max-h-48">
                                {searchResults.map((track) => (
                                    <div
                                        key={track.id}
                                        onClick={() => selectTrack(track)}
                                        className="p-3 border-b border-slate-800 hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center group"
                                    >
                                        <div>
                                            <p className="font-bold text-sm text-slate-200">
                                                {track.trackName}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {track.artistName} •{" "}
                                                {track.albumName}
                                            </p>
                                        </div>
                                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold uppercase tracking-widest group-hover:bg-blue-500/40 transition-colors">
                                            Seleccionar
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedTrack && parsedLyrics.length > 0 && (
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-4 mt-auto">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-xs text-green-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />{" "}
                                                LRC Listo
                                            </p>
                                        </div>
                                        <p className="font-bold text-sm text-white">
                                            {selectedTrack.trackName}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {parsedLyrics.length} líneas
                                            sincronizadas
                                        </p>
                                    </div>

                                    {/* Botonera dinámica de Paginación */}
                                    {!isWaitingToContinue &&
                                        analysisProgress !== 100 && (
                                            <button
                                                onClick={processNextChunk}
                                                disabled={
                                                    isAnalyzing || !isOnline
                                                }
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/50 min-w-[140px] justify-center disabled:opacity-50"
                                            >
                                                {isAnalyzing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4" />
                                                )}
                                                ANALIZAR IDIOMA
                                            </button>
                                        )}

                                    {isWaitingToContinue && (
                                        <button
                                            onClick={processNextChunk}
                                            disabled={isAnalyzing || !isOnline}
                                            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-900/50 min-w-[140px] justify-center disabled:opacity-50 animate-pulse"
                                        >
                                            {isAnalyzing ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ArrowRight className="w-4 h-4" />
                                            )}
                                            CONTINUAR ({analysisProgress}%)
                                        </button>
                                    )}

                                    {analysisProgress === 100 && (
                                        <div className="bg-green-900/40 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" />{" "}
                                            ANÁLISIS COMPLETO
                                        </div>
                                    )}
                                </div>

                                {/* Visual Progress Bar Deterministico */}
                                {(analysisProgress > 0 || isAnalyzing) && (
                                    <div className="mt-2">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                            <span>Progreso de Análisis IA</span>
                                            <span>{analysisProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
                                            <div
                                                className={`h-full transition-all duration-500 ease-out ${isWaitingToContinue ? "bg-amber-500" : "bg-blue-500"}`}
                                                style={{
                                                    width: `${analysisProgress}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mensajes de Error */}
                {analysisError && (
                    <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-4 rounded-2xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-sm font-medium">{analysisError}</p>
                    </div>
                )}

                {/* CONTENEDOR DE ESTUDIO */}
                {parsedLyrics.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                        {/* Panel Izquierdo: Karaoke LRC */}
                        <div className="lg:col-span-5 bg-slate-800 rounded-3xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-[600px]">
                            <div className="p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 z-10 flex justify-between items-center shadow-sm">
                                <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                    <Music className="w-4 h-4 text-blue-400" />{" "}
                                    Modo Karaoke Universal
                                </h3>
                            </div>
                            <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar relative">
                                {parsedLyrics.map((line, idx) => {
                                    const isActive = currentLineIndex === idx;
                                    const realAudioTimeSync = Math.max(
                                        0,
                                        line.time + syncOffset,
                                    );

                                    return (
                                        <div
                                            id={`karaoke-line-${idx}`}
                                            key={idx}
                                            onClick={() =>
                                                handleSeek(realAudioTimeSync)
                                            }
                                            className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border-l-4 ${
                                                isActive
                                                    ? "bg-blue-900/20 border-blue-500 shadow-lg shadow-black/20 translate-x-1"
                                                    : "border-transparent hover:bg-slate-700/50 opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span
                                                    className={`text-[10px] font-mono ${isActive ? "text-blue-400" : "text-slate-500"}`}
                                                >
                                                    {formatTime(line.time)}{" "}
                                                    {syncOffset !== 0 &&
                                                        `(Audio: ${formatTime(realAudioTimeSync)})`}
                                                </span>
                                            </div>
                                            <p
                                                className={`text-xl leading-relaxed transition-colors ${isActive ? "text-white font-black" : "text-slate-300"}`}
                                            >
                                                {line.text}
                                            </p>
                                            {line.pronunciation && (
                                                <p
                                                    className={`text-xs font-mono mt-1.5 tracking-wide transition-colors ${isActive ? "text-blue-300 font-bold" : "text-slate-500"}`}
                                                >
                                                    {line.pronunciation}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Panel Derecho: Análisis IA */}
                        <div className="lg:col-span-7 bg-slate-800 rounded-3xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-[600px]">
                            <div className="flex bg-slate-900 p-2 gap-2 shadow-sm z-10 relative">
                                <button
                                    onClick={() => setActiveTab("dictionary")}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === "dictionary" ? "bg-slate-700 text-white shadow-sm border border-slate-600" : "text-slate-500 hover:text-slate-300"}`}
                                >
                                    <BookOpen className="w-4 h-4" /> DICCIONARIO
                                </button>
                                <button
                                    onClick={() => setActiveTab("sentences")}
                                    className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === "sentences" ? "bg-slate-700 text-white shadow-sm border border-slate-600" : "text-slate-500 hover:text-slate-300"}`}
                                >
                                    <Languages className="w-4 h-4" /> ANÁLISIS
                                    POR FRASES
                                </button>
                            </div>

                            <div className="flex-grow overflow-y-auto p-6 custom-scrollbar scroll-smooth">
                                {!analysis && !isAnalyzing ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                                        <div className="bg-slate-900 p-6 rounded-full border border-slate-800">
                                            <FileText className="w-12 h-12 opacity-50 text-blue-500" />
                                        </div>
                                        <p className="text-sm font-medium">
                                            Pulsa Analizar para generar el
                                            contenido bloque a bloque.
                                        </p>
                                    </div>
                                ) : !analysis && isAnalyzing ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                                        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-white mb-2">
                                                Procesando primer bloque...
                                            </p>
                                            <p className="text-sm">
                                                El diccionario aparecerá en
                                                segundos.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {activeTab === "dictionary" &&
                                            analysis && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {analysis.word_breakdown.map(
                                                        (item, i) => {
                                                            const isSyncActive =
                                                                item.line_index ===
                                                                currentLineIndex;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    data-dict-line={
                                                                        item.line_index
                                                                    }
                                                                    className={`p-4 rounded-2xl border transition-all duration-300 ${isSyncActive ? "bg-blue-900/30 border-blue-500 shadow-lg scale-[1.02]" : "bg-slate-900 border-slate-700 hover:border-blue-500/50"}`}
                                                                >
                                                                    <div className="font-black text-xl text-white mb-1">
                                                                        {
                                                                            item.original
                                                                        }
                                                                    </div>
                                                                    {item.pronunciation &&
                                                                        item.pronunciation !==
                                                                            "---" && (
                                                                            <div className="text-[10px] text-blue-400 font-mono mb-3 tracking-widest uppercase">
                                                                                {
                                                                                    item.pronunciation
                                                                                }
                                                                            </div>
                                                                        )}
                                                                    <div
                                                                        className={`text-sm font-bold border-l-2 pl-3 mb-2 transition-colors ${isSyncActive ? "text-blue-300 border-blue-400" : "text-slate-200 border-blue-500"}`}
                                                                    >
                                                                        {
                                                                            item.significado
                                                                        }
                                                                    </div>
                                                                    <div className="text-[11px] text-slate-400 italic leading-relaxed">
                                                                        {
                                                                            item.analisis_gramatical
                                                                        }
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                    {isAnalyzing && (
                                                        <div className="p-4 rounded-2xl border border-slate-700 border-dashed flex items-center justify-center bg-slate-900/50 min-h-[120px]">
                                                            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                                                        </div>
                                                    )}
                                                    {isWaitingToContinue && (
                                                        <div className="p-4 rounded-2xl border border-amber-700 border-dashed flex flex-col items-center justify-center bg-slate-900/50 min-h-[120px] text-center gap-2">
                                                            <ArrowRight className="w-6 h-6 text-amber-500" />
                                                            <span className="text-xs text-amber-400 font-bold">
                                                                Pausado. Pulsa
                                                                Continuar para
                                                                reanudar el
                                                                analisis.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        {activeTab === "sentences" &&
                                            analysis && (
                                                <div className="space-y-6">
                                                    {analysis.sentence_analysis.map(
                                                        (phrase, i) => {
                                                            const isSyncActive =
                                                                phrase.line_index ===
                                                                currentLineIndex;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    data-sentence-line={
                                                                        phrase.line_index
                                                                    }
                                                                    className={`rounded-3xl p-6 border transition-all duration-300 ${isSyncActive ? "bg-blue-900/20 border-blue-500 shadow-lg shadow-blue-900/20 scale-[1.01]" : "bg-slate-900 border-slate-700"}`}
                                                                >
                                                                    <div className="mb-6">
                                                                        <h4 className="text-2xl font-black text-white leading-tight mb-2">
                                                                            {
                                                                                phrase.original
                                                                            }
                                                                        </h4>
                                                                        {phrase.pronunciation &&
                                                                            phrase.pronunciation !==
                                                                                "---" && (
                                                                                <p className="text-xs text-blue-400 font-mono tracking-widest uppercase font-bold">
                                                                                    {
                                                                                        phrase.pronunciation
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                    </div>
                                                                    <div className="flex flex-col xl:flex-row gap-4">
                                                                        <div
                                                                            className={`flex-1 p-5 rounded-2xl border transition-colors ${isSyncActive ? "bg-blue-900/40 border-blue-500/50" : "bg-slate-800 border-slate-600"}`}
                                                                        >
                                                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                                                <ChevronRight className="w-3 h-3" />{" "}
                                                                                Significado
                                                                            </p>
                                                                            <p className="text-white font-bold text-base leading-snug mb-3">
                                                                                "
                                                                                {
                                                                                    phrase.explicacion_natural
                                                                                }
                                                                                "
                                                                            </p>
                                                                            <p className="text-xs text-slate-400 italic pt-3 border-t border-slate-700">
                                                                                Literal:{" "}
                                                                                {
                                                                                    phrase.traduccion_literal
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                        <div
                                                                            className={`flex-1 p-5 rounded-2xl border transition-colors ${isSyncActive ? "bg-blue-800/30 border-blue-400/50" : "bg-blue-900/20 border-blue-800/50"}`}
                                                                        >
                                                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">
                                                                                Construcción
                                                                            </p>
                                                                            <p className="text-blue-200 text-xs font-medium leading-relaxed">
                                                                                {
                                                                                    phrase.notas_construccion
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                    {isAnalyzing && (
                                                        <div className="rounded-3xl p-6 border border-slate-700 border-dashed flex flex-col items-center justify-center bg-slate-900/50 min-h-[150px] gap-2">
                                                            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                                                            <span className="text-xs text-slate-500 font-mono">
                                                                Procesando
                                                                bloque...
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isWaitingToContinue && (
                                                        <div className="rounded-3xl p-6 border border-amber-700 border-dashed flex flex-col items-center justify-center bg-slate-900/50 min-h-[150px] text-center gap-2">
                                                            <ArrowRight className="w-8 h-8 text-amber-500" />
                                                            <span className="text-sm text-amber-400 font-bold uppercase tracking-widest">
                                                                Analisis pausado
                                                            </span>
                                                            <span className="text-xs text-slate-500">
                                                                Pulsa el boton
                                                                "Continuar" para
                                                                retomar desde el
                                                                siguiente
                                                                bloque.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TALLER DE CREACIÓN LRC MANUAL */}
                <div className="mt-12 pt-8 border-t-2 border-slate-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-900/50">
                            <PenTool className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white uppercase italic">
                                Taller de Creación LRC
                            </h2>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
                                Sincroniza tus propias letras manualmente
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Izquierda: Input de texto */}
                        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex flex-col h-[500px]">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                    Pega la letra en bruto
                                </label>
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {creatorLines.length} líneas
                                </span>
                            </div>
                            <textarea
                                value={creatorRawText}
                                onChange={handleCreatorTextChange}
                                placeholder="Pega la letra de la canción aquí. Cada salto de línea será un bloque a sincronizar..."
                                className="flex-grow bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors resize-none custom-scrollbar leading-relaxed"
                            />
                        </div>

                        {/* Derecha: Interfaz de Sincronización */}
                        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex flex-col h-[500px]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                    Sincronizador en Vivo
                                </h3>
                                {creatorLines.filter((l) => l.time !== null)
                                    .length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={loadCreatorToPlayer}
                                            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-slate-600"
                                            title="Cargar al reproductor principal (Paso 2)"
                                        >
                                            <ArrowUpCircle className="w-3 h-3" />{" "}
                                            USAR LRC
                                        </button>
                                        <button
                                            onClick={downloadLrcFile}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-lg shadow-indigo-900/50"
                                            title="Descargar archivo .lrc"
                                        >
                                            <Download className="w-3 h-3" />{" "}
                                            DESCARGAR
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Botón Principal de Stamp */}
                            <button
                                onClick={stampCurrentTime}
                                disabled={
                                    !audioFile ||
                                    creatorLines.length === 0 ||
                                    creatorCurrentIndex >= creatorLines.length
                                }
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-900/20 disabled:shadow-none transition-all active:scale-95 mb-4 flex flex-col items-center justify-center gap-1"
                            >
                                <span>MARCAR TIEMPO AHORA</span>
                                <span className="text-xs font-normal opacity-70">
                                    {!audioFile
                                        ? "Falta cargar audio en el Paso 1"
                                        : "Clic para registrar el segundo exacto"}
                                </span>
                            </button>

                            <div className="flex-grow overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 p-4 custom-scrollbar space-y-2 relative">
                                {creatorLines.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm font-medium italic">
                                        Pega texto a la izquierda para empezar
                                    </div>
                                )}

                                {creatorLines.map((line, idx) => {
                                    const isCurrentTarget =
                                        idx === creatorCurrentIndex;
                                    const isStamped = line.time !== null;

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                                isCurrentTarget
                                                    ? "bg-indigo-900/30 border-indigo-500 shadow-sm"
                                                    : isStamped
                                                      ? "bg-slate-800 border-slate-700 opacity-60 hover:opacity-100"
                                                      : "border-transparent text-slate-500"
                                            }`}
                                        >
                                            <div className="w-16 flex-shrink-0 flex items-center">
                                                {isStamped ? (
                                                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                                                        {formatTime(line.time)}
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`text-xs font-mono px-2 py-1 rounded ${isCurrentTarget ? "text-indigo-300 bg-indigo-500/20 animate-pulse" : "text-slate-600 bg-slate-800"}`}
                                                    >
                                                        --:--
                                                    </span>
                                                )}
                                            </div>

                                            <p
                                                className={`flex-grow text-sm ${isCurrentTarget ? "text-white font-bold" : isStamped ? "text-slate-300" : ""}`}
                                            >
                                                {line.text}
                                            </p>

                                            {isStamped && (
                                                <button
                                                    onClick={() =>
                                                        clearStamp(idx)
                                                    }
                                                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                                    title="Borrar marca de tiempo"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-12 border-t border-slate-800/80 pt-8">
                <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/30">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-blue-400">
                                Web Karaoke
                            </p>
                            <h2 className="text-2xl font-black text-white">
                                Creado por Feryael Justice
                            </h2>
                            <p className="text-sm leading-relaxed text-slate-400">
                                Herramienta experimental para estudiar canciones con sincronizacion LRC, analisis linguisticos y trabajo local con audio.
                            </p>
                        </div>

                        <div className="space-y-3 text-sm text-slate-400 lg:text-right">
                            <p>&copy; {currentYear} Feryael Justice. Todos los derechos reservados.</p>
                            <div className="flex flex-wrap gap-3 lg:justify-end">
                                <a href="#aviso-legal" className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-blue-500 hover:text-white">
                                    Aviso legal
                                </a>
                                <a href="#privacidad" className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-blue-500 hover:text-white">
                                    Privacidad
                                </a>
                                <a href="#terminos" className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-blue-500 hover:text-white">
                                    Terminos de uso
                                </a>
                                <a href="#cookies" className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-blue-500 hover:text-white">
                                    Cookies
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 lg:grid-cols-2">
                        <section id="aviso-legal" className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                            <h3 className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-white">Aviso legal</h3>
                            <p className="text-sm leading-relaxed text-slate-400">
                                Este proyecto se ofrece como software informativo y experimental. El usuario es responsable del uso que haga de los audios, letras y analisis generados, asi como de contar con los derechos o permisos necesarios sobre el contenido que cargue.
                            </p>
                        </section>

                        <section id="privacidad" className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                            <h3 className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-white">Politica de privacidad</h3>
                            <p className="text-sm leading-relaxed text-slate-400">
                                La app trabaja principalmente en cliente. Los archivos de audio y LRC que sube el usuario se procesan en el navegador, salvo las solicitudes externas que el propio usuario active hacia LRCLIB y Gemini para buscar letras o generar analisis.
                            </p>
                        </section>

                        <section id="terminos" className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                            <h3 className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-white">Terminos de uso</h3>
                            <p className="text-sm leading-relaxed text-slate-400">
                                El servicio se proporciona tal cual, sin garantias de disponibilidad, precision o ausencia de errores. El usuario debe revisar el contenido generado por IA antes de usarlo con fines educativos, publicos o comerciales.
                            </p>
                        </section>

                        <section id="cookies" className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                            <h3 className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-white">Politica de cookies</h3>
                            <p className="text-sm leading-relaxed text-slate-400">
                                Esta version del proyecto no define cookies propias para funcionalidad, analitica o publicidad. Si en el futuro se integra analitica, autenticacion o servicios de terceros que usen cookies, esta politica debera actualizarse antes del despliegue publico.
                            </p>
                        </section>
                    </div>
                </div>
            </footer>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
        </div>
    );
};

export default App;

