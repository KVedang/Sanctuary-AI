import React from 'react';
import { Mic, MicOff, Check, X, Volume2 } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmText: (transcription: string) => void;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  isOpen,
  onClose,
  onConfirmText,
}) => {
  const {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  } = useSpeechRecognition();

  if (!isOpen) return null;

  const handleApply = () => {
    if (transcript.trim()) {
      onConfirmText(transcript.trim());
    }
    stopListening();
    resetTranscript();
    onClose();
  };

  const handleCancel = () => {
    stopListening();
    resetTranscript();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isListening ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-stone-100 text-stone-700'}`}>
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-stone-900 text-base">
                Voice Journaling
              </h3>
              <p className="text-xs text-stone-500">
                Speak your thoughts freely, then review and edit before saving.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {!isSupported ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              Web Speech recognition is not supported in your current browser. You can still type directly in the editor!
            </div>
          ) : (
            <>
              {/* Record Toggle */}
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <button
                  id="voice-mic-toggle-btn"
                  onClick={isListening ? stopListening : startListening}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-200 scale-105'
                      : 'bg-stone-900 hover:bg-stone-800 text-amber-300'
                  }`}
                >
                  {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
                <p className="text-xs font-medium text-stone-600">
                  {isListening ? 'Listening... Click to pause' : 'Click microphone to begin dictating'}
                </p>
              </div>

              {/* Editable Transcription Area */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Editable Transcription</span>
                  {transcript && (
                    <button
                      onClick={resetTranscript}
                      className="text-stone-400 hover:text-stone-600 text-[11px] font-normal"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your transcribed thoughts will stream here. You can refine or correct words before inserting..."
                  rows={5}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none font-sans"
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2.5">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="voice-confirm-btn"
            onClick={handleApply}
            disabled={!transcript.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-stone-900 hover:bg-stone-800 text-stone-50 rounded-lg transition cursor-pointer disabled:opacity-40"
          >
            <Check className="w-4 h-4 text-amber-300" />
            <span>Insert to Journal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
