import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Type, 
  Settings as SettingsIcon, 
  ChevronUp, 
  X,
  FlipHorizontal,
  Save,
  Video,
  StopCircle,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * TelePro - Simple Teleprompter
 * A simple web-based teleprompter with camera preview and auto-scrolling text.
 */

export default function App() {
  const [text, setText] = useState<string>(
    "Welcome to TelePro. This is a simple teleprompter for your presentations. " +
    "Paste your news or presentation text here to start reading smoothly. " +
    "You can adjust the speed, mirror the display, and see yourself through the camera. " +
    "Good luck with your presentation!"
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(30); // pixels per second
  const [fontSize, setFontSize] = useState<number>(32);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [cameraRetryCount, setCameraRetryCount] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const scrollPosRef = useRef<number>(0);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    // Clear previous stream if any
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    const constraintsList = [
      { video: { facingMode: 'user' }, audio: true },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: true },
      { video: true, audio: false }
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraint of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        if (stream) break;
      } catch (err) {
        lastError = err;
        console.warn("Retrying with different constraints...", err);
      }
    }

    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      setCameraError(null);
    } else {
      console.error("Final camera access error:", lastError);
      setCameraError(lastError?.message || "Requested device not found");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera, cameraRetryCount]);

  // Scrolling Logic
  const animateScroll = useCallback((time: number) => {
    if (isPlaying) {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const deltaTime = (time - lastTimeRef.current) / 1000;
      scrollPosRef.current += scrollSpeed * deltaTime;
      
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollPosRef.current;
        
        // Stop if it goes way past
        if (scrollPosRef.current > scrollContainerRef.current.scrollHeight + (window.innerHeight / 2)) {
          setIsPlaying(false);
          scrollPosRef.current = 0;
        }
      }
    } else {
      lastTimeRef.current = 0;
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animateScroll);
  }, [isPlaying, scrollSpeed]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animateScroll);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animateScroll]);

  const handleReset = () => {
    setIsPlaying(false);
    scrollPosRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    lastTimeRef.current = 0;
  };

  const handleSave = () => {
    localStorage.setItem('telepro_text', text);
    alert('Text saved to local storage!');
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    const options = { mimeType: 'video/webm;codecs=vp8' };
    
    // Check supported types
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    let selectedType = '';
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedType = type;
        break;
      }
    }

    try {
      const recorder = new MediaRecorder(stream, selectedType ? { mimeType: selectedType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      alert("Recording failed to start.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadVideo = () => {
    if (recordedVideoUrl) {
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      a.download = `telepro-recording-${new Date().getTime()}.webm`;
      a.click();
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('telepro_text');
    if (saved) setText(saved);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[var(--color-app-bg)] text-white font-sans overflow-hidden p-3 sm:p-5 gap-3 sm:gap-5">
      {/* Top Header */}
      <div className="flex justify-between items-center h-8 sm:h-10 shrink-0">
        <div className="font-extrabold text-base sm:text-lg uppercase tracking-tight">
          TELEPRO<span className="text-[var(--color-accent)]">MPTER</span>
        </div>
        <div className="bg-[rgba(0,230,118,0.1)] text-[var(--color-accent)] px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-semibold uppercase tracking-wider border border-[var(--color-accent)]">
          {isPlaying ? 'ACTIVE' : 'READY'}
        </div>
      </div>

      {/* Top Section: Camera Preview */}
      <div className="relative w-full h-1/4 sm:h-[280px] shrink-0 bg-black rounded-[var(--radius-geometric)] overflow-hidden flex items-center justify-center border-2 border-[var(--color-surface)] shadow-lg">
        {cameraError ? (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="space-y-1">
              <p className="text-[10px] text-white font-bold uppercase tracking-wider">Connection Error</p>
              <p className="text-xs text-zinc-500 max-w-[220px]">
                {cameraError.toLowerCase().includes('not found') 
                  ? "Camera device not found. Please connect a webcam." 
                  : "Camera access is restricted. Try opening in a new tab."}
              </p>
            </div>
            <button 
              onClick={() => setCameraRetryCount(prev => prev + 1)}
              className="mt-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-[10px] font-bold transition-all active:scale-95"
            >
              RETRY CAMERA
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover transition-transform duration-500 ${isMirrored ? 'scale-x-[-1]' : ''}`}
            id="camera-preview"
          />
        )}
        {!cameraError && (
          <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded text-[10px] text-white">
            1920x1080 • 30fps
          </div>
        )}
      </div>

      {/* Middle Section: Prompter Text Area */}
      <div className="relative flex-1 bg-[var(--color-surface)] rounded-[var(--radius-geometric)] overflow-hidden flex flex-col border-2 border-[#333]">
        {/* Focus Marker */}
        <div className="absolute top-1/2 left-0 right-0 h-[60px] sm:h-[80px] -mt-[30px] sm:-mt-[40px] bg-white/[0.03] border-t border-white/10 border-b border-white/10 pointer-events-none z-10" />
        
        <div 
          ref={scrollContainerRef}
          className={`flex-1 overflow-y-auto px-4 sm:px-10 py-[45vh] scroll-smooth ${isMirrored ? 'scale-x-[-1]' : ''}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.flex-1::-webkit-scrollbar { display: none; }`}</style>
          <div 
            className="max-w-3xl mx-auto text-center"
            style={{ fontSize: `${fontSize}px`, lineHeight: '1.5' }}
          >
            <p className="whitespace-pre-wrap font-bold text-[var(--color-prompter-yellow)] transition-all duration-300 drop-shadow-sm">
              {text}
            </p>
            {/* Added buffer at bottom to allow scrolling past last line */}
            <div className="h-[80vh]" />
          </div>
        </div>
      </div>

      {/* Bottom Section: Controls */}
      <div className="bg-[var(--color-surface)] border border-[#333] rounded-[var(--radius-geometric)] px-3 sm:px-5 py-3 sm:py-0 min-h-[130px] sm:h-[100px] shrink-0 flex flex-col justify-center">
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_3fr_1fr] items-center gap-3 sm:gap-4">
          
          {/* Main Controls: Buttons */}
          <div className="order-2 sm:order-2 w-full sm:w-auto">
            <div className="grid grid-cols-4 gap-2 mb-3 sm:hidden">
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all ${isRecording ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/10 text-white border border-white/5'}`}
                title="Record"
              >
                {isRecording ? <StopCircle size={20} /> : <Video size={20} />}
              </button>
              <button 
                onClick={handleSave}
                className="p-3 rounded-xl border border-[#444] text-white font-semibold flex items-center justify-center hover:bg-[#252525] transition-all"
                title="Save"
              >
                <Save size={20} />
              </button>
              <button 
                onClick={handleReset}
                className="p-3 rounded-xl border border-[#444] text-white font-semibold flex items-center justify-center hover:bg-[#252525] transition-all"
                title="Repeat"
              >
                <RotateCcw size={20} />
              </button>
              <button 
                onClick={() => setShowEditor(true)}
                className="p-3 rounded-xl border border-[#444] text-white font-semibold flex items-center justify-center hover:bg-[#252525] transition-all"
                title="Input"
              >
                <Type size={20} />
              </button>
            </div>
            
            <div className="flex justify-center items-center gap-2 sm:gap-4 w-full sm:w-auto">
              {/* This Start button will be full-width on mobile below the icons */}
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex-1 sm:flex-none py-4 sm:px-12 sm:py-3 rounded-xl sm:rounded-lg font-black flex items-center justify-center gap-3 transition-all uppercase text-sm sm:text-base ${isPlaying ? 'bg-[var(--color-danger)] text-white shadow-[0_0_20px_rgba(255,82,82,0.4)]' : 'bg-[var(--color-accent)] text-black shadow-[0_0_20px_rgba(0,230,118,0.4)]'}`}
                id="btn-play-pause"
              >
                {isPlaying ? <><Pause size={24} fill="currentColor" /> STOP</> : <><Play size={24} fill="currentColor" /> START</>}
              </button>

              {/* Desktop-only Record button (already handled by hidden sm:flex above, but I need to keep the structure clear) */}
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`hidden sm:flex px-6 py-3 rounded-lg font-semibold items-center gap-2 transition-all uppercase text-sm ${isRecording ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}
                id="btn-record-desktop"
              >
                {isRecording ? <><StopCircle size={16} /> REC STOP</> : <><Video size={16} /> RECORD</>}
              </button>

              <button 
                onClick={handleSave}
                className="hidden sm:flex px-6 py-3 rounded-lg border border-[#444] text-white font-semibold items-center gap-2 hover:bg-[#252525] transition-all uppercase text-sm"
              >
                💾 SAVE
              </button>

              <button 
                onClick={handleReset}
                className="hidden sm:flex px-6 py-3 rounded-lg border border-[#444] text-white font-semibold items-center gap-2 hover:bg-[#252525] transition-all uppercase text-sm"
              >
                🔄 REPEAT
              </button>

              <button 
                onClick={() => setShowEditor(true)}
                className="hidden sm:flex px-6 py-3 rounded-lg border border-[#444] text-white font-semibold items-center gap-2 hover:bg-[#252525] transition-all uppercase text-sm"
              >
                📝 INPUT
              </button>
            </div>
          </div>

          {/* Info and Settings: Ranges */}
          <div className="flex order-1 sm:order-1 items-center justify-between w-full sm:w-auto text-[10px] sm:text-[12px] text-[#888] gap-4">
            <div className="flex-1 flex items-center gap-2 bg-black/20 p-2 rounded-lg">
              <span className="uppercase font-mono shrink-0">Speed</span>
              <input 
                type="range" 
                min="5" 
                max="150" 
                value={scrollSpeed} 
                onInput={(e) => setScrollSpeed(parseInt((e.target as HTMLInputElement).value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
            <div className="flex items-center gap-2">
               <span className="sm:hidden">{fontSize}px</span>
               <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg border border-[#444] text-white transition-all ${showSettings ? 'bg-[#333] border-[var(--color-accent)]' : ''}`}
              >
                <SettingsIcon size={16} />
              </button>
            </div>
            <div className="hidden sm:block">Text Size: {fontSize}px</div>
          </div>

          {/* Right: Settings Toggle (Desktop only) */}
          <div className="hidden sm:flex order-3 justify-end">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg border border-[#444] text-white transition-all hover:bg-[#252525] ${showSettings ? 'bg-[#333] border-[var(--color-accent)]' : ''}`}
              title="Settings"
              id="btn-settings-desktop"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Settings/Mirror Toggle (Original functionality preserved) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-32 right-5 bg-[var(--color-surface)] border-2 border-[#333] p-4 rounded-[var(--radius-geometric)] shadow-2xl z-40"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase text-zinc-500">
                  <span>Font Size</span>
                  <span>{fontSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="16" 
                  max="100" 
                  value={fontSize} 
                  onInput={(e) => setFontSize(parseInt((e.target as HTMLInputElement).value))}
                  className="w-48 accent-[var(--color-accent)] h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <button 
                onClick={() => setIsMirrored(!isMirrored)}
                className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold transition-colors ${isMirrored ? 'bg-[var(--color-accent)] text-black' : 'bg-zinc-800 text-zinc-400'}`}
              >
                <FlipHorizontal size={14} />
                MIRROR DISPLAY
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recorded Video Download Overlay */}
      <AnimatePresence>
        {recordedVideoUrl && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          >
            <div className="bg-[var(--color-surface)] border-2 border-[#333] p-6 rounded-[var(--radius-geometric)] shadow-2xl max-w-sm w-full text-center space-y-4">
              <div className="w-16 h-16 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto">
                <Video size={32} />
              </div>
              <h3 className="text-xl font-bold">Recording Finished</h3>
              <p className="text-sm text-zinc-400">Your video is ready to download.</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={downloadVideo}
                  className="w-full py-3 bg-[var(--color-accent)] text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <Download size={18} /> DOWNLOAD VIDEO
                </button>
                <button 
                  onClick={() => setRecordedVideoUrl(null)}
                  className="w-full py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-colors"
                >
                  DISMISS
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Text Editor */}
      <AnimatePresence>
        {showEditor && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-50 bg-black flex flex-col pt-[max(0px,env(safe-area-inset-top))]"
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Edit Script</h2>
              <button 
                onClick={() => setShowEditor(false)}
                className="p-2 hover:bg-zinc-800 rounded-full"
                id="btn-close-editor"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 p-4 bg-zinc-950">
              <textarea 
                className="w-full h-full bg-zinc-900 text-white p-6 rounded-2xl focus:outline-none focus:ring-1 focus:ring-zinc-700 text-lg resize-none border border-zinc-800"
                placeholder="Paste news, presentation script, or any text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                id="text-input"
              />
            </div>
            <div className="p-6 bg-zinc-900 border-t border-zinc-800">
              <button 
                onClick={() => setShowEditor(false)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                id="btn-apply-text"
              >
                Apply Text
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .safe-bottom {
          padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: var(--color-accent);
          border-radius: 50%;
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: var(--color-accent);
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
