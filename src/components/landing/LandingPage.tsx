import React from 'react';
import { 
  BookOpen, 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  Compass, 
  CheckCircle2, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col selection:bg-amber-200">
      {/* Top Bar */}
      <header className="border-b border-stone-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center text-amber-300 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-serif font-semibold text-lg tracking-tight text-stone-900">
              Sanctuary AI
            </span>
          </div>

          <button
            id="login-btn-nav"
            onClick={signInWithGoogle}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-800 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            <span>{loading ? 'Connecting...' : 'Sign In with Google'}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center gap-2 self-center px-3.5 py-1 rounded-full text-xs font-medium bg-stone-200/70 text-stone-700 mb-8 border border-stone-300/50">
          <Lock className="w-3.5 h-3.5 text-stone-600" />
          <span>Zero-Knowledge Isolation &bull; Client-to-Cloud Encryption</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-serif font-medium tracking-tight text-stone-950 max-w-3xl mx-auto leading-[1.15]">
          Your private sanctuary for honest thought and AI-guided reflection.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-stone-600 max-w-2xl mx-auto font-sans leading-relaxed">
          Write freely, organize your inner world, dialogue with Gemini, and discover trends across your personal history—with mathematical user data isolation.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            id="continue-with-google-hero"
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-stone-900 text-stone-50 font-medium text-base hover:bg-stone-800 transition shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.54 0 2.92.54 4.02 1.43l3.01-3.01C17.21 1.77 14.81 1 12 1 7.42 1 3.52 3.65 1.63 7.5l3.66 2.84C6.18 7.37 8.84 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.28c0-.78-.07-1.53-.2-2.28H12v4.51h6.47c-.28 1.48-1.12 2.74-2.39 3.59l3.69 2.86c2.16-1.99 3.72-4.92 3.72-8.68z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.66c-.23-.68-.36-1.41-.36-2.16s.13-1.48.36-2.16L1.63 7.5C.59 9.58 0 11.97 0 14.5s.59 4.92 1.63 7l3.66-2.84z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.69-2.86c-1.08.72-2.45 1.16-4.24 1.16-3.16 0-5.82-2.37-6.71-5.34L1.63 17.5C3.52 21.35 7.42 24 12 24z"
              />
            </svg>
            <span>{loading ? 'Authorizing...' : 'Continue with Google'}</span>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-lg text-stone-900 mb-2">
                Absolute Data Isolation
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                User-scoped Firestore subcollections and cryptographic token checks guarantee that only you can ever view or query your journals.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs text-stone-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tested Access Control</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-lg text-stone-900 mb-2">
                Multi-Turn Reflection
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Engage in meaningful multi-turn dialogue with Gemini. Switch modes between Socratic inquiry, executive summary, brainstorms, and goal coaching.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs text-stone-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Resilient Model Fallback</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-lg text-stone-900 mb-2">
                Ask My Journal
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                Inquire into your past reflections: "What recurring obstacles appeared this month?" or "What goals did I discuss regarding my career?"
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs text-stone-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Strictly User-Bound Retrieval</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        <p>Private AI Journal &bull; Built with Cloud Firestore, Firebase Auth &amp; Google Gemini API.</p>
      </footer>
    </div>
  );
};
