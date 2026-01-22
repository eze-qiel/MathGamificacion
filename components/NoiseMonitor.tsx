import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, AlertTriangle, Settings2 } from 'lucide-react';

interface NoiseMonitorProps {
  onNoiseLevelChange: (isLoud: boolean) => void;
}

const NoiseMonitor: React.FC<NoiseMonitorProps> = ({ onNoiseLevelChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isLoud, setIsLoud] = useState(false);
  
  // Sensitivity: 0-100. Higher sensitivity = lower threshold.
  // Default 65 means threshold is 35 (100 - 65)
  const [sensitivity, setSensitivity] = useState(65); 
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      setIsListening(true);
      analyzeAudio();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  const stopListening = () => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setVolume(0);
    setIsLoud(false);
    onNoiseLevelChange(false);
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    // Normalize roughly to 0-100 scale based on typical mic input
    const normalizedVolume = Math.min(100, Math.round((average / 255) * 200)); 

    setVolume(normalizedVolume);
    
    // Calculate threshold based on current sensitivity state
    // If sensitivity is 100, threshold is 5 (very sensitive)
    // If sensitivity is 0, threshold is 95 (very hard to trigger)
    // We use a ref or closure? The state updates in the loop might be stale if we don't watch it, 
    // but requestAnimationFrame usually picks up state if component re-renders. 
    // However, for smooth animation loops in React, it's often safer to calculate inside render or use refs.
    // Here we will use the state directly, relying on React to update the closure in the next render cycle 
    // or just checking `sensitivity` which might be stale in this specific closure pattern without useEffect dependencies.
    // TO FIX STALE STATE: We will just read the current threshold logic inside the render or pass it via Ref.
    // A simple fix for this specific React pattern:
    // actually, let's use a Ref for sensitivity to ensure the animation loop always reads the latest value.
  };

  // We need a ref to track sensitivity inside the animation loop
  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const analyzeLoop = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const normalizedVolume = Math.min(100, Math.round((average / 255) * 200)); 

    setVolume(normalizedVolume);
    
    // Use Ref for latest value
    const threshold = 100 - sensitivityRef.current; 
    
    const loudState = normalizedVolume > threshold;
    setIsLoud(loudState);
    onNoiseLevelChange(loudState);

    animationFrameRef.current = requestAnimationFrame(analyzeLoop);
  };

  // Replace the previous analyzeAudio with this wrapper
  useEffect(() => {
    if (isListening) {
      animationFrameRef.current = requestAnimationFrame(analyzeLoop);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isListening]); // Re-bind loop if listening state changes


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`fixed bottom-4 left-4 p-4 rounded-xl shadow-lg transition-all duration-300 z-50 flex flex-col gap-3 border-2 ${isLoud ? 'bg-red-100 border-red-500 animate-pulse' : 'bg-white border-gray-200'}`}>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={isListening ? stopListening : startListening}
          className={`p-3 rounded-full text-white transition-colors ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {isListening && (
          <div className="flex flex-col w-40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-gray-500">NIVEL DE RUIDO</span>
              {isLoud && <AlertTriangle size={14} className="text-red-600" />}
            </div>
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${isLoud ? 'bg-red-500' : 'bg-emerald-400'}`}
                style={{ width: `${volume}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {isListening && (
        <div className="w-full pt-2 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <Settings2 size={10} /> Sensibilidad
            </span>
            <span className="text-[10px] font-bold text-indigo-600">{sensitivity}%</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="95" 
            step="1"
            value={sensitivity} 
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      )}
    </div>
  );
};

export default NoiseMonitor;