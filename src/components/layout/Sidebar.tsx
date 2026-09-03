import React from 'react';
import { 
  LayoutDashboard, 
  PenSquare, 
  History, 
  Sparkles, 
  Target, 
  Search, 
  Settings, 
  LogOut, 
  BookOpen,
  Bot
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 
  | 'dashboard' 
  | 'editor' 
  | 'assistant'
  | 'history' 
  | 'insights' 
  | 'goals' 
  | 'ask' 
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNewReflection: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onNewReflection }) => {
  const { profile, logOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assistant', label: 'AI Companion', icon: Bot },
    { id: 'history', label: 'Journal Archive', icon: History },
    { id: 'insights', label: 'Insights & Digest', icon: Sparkles },
    { id: 'goals', label: 'Actionable Goals', icon: Target },
    { id: 'ask', label: 'Ask My Journal', icon: Search },
    { id: 'settings', label: 'Privacy & Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-stone-900 text-stone-300 flex flex-col h-screen border-r border-stone-800 shrink-0 select-none">
      {/* Brand */}
      <div className="p-5 flex items-center gap-3 border-b border-stone-800/80">
        <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center font-serif font-bold shadow-xs">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-serif font-semibold text-stone-100 text-sm tracking-wide">
            Sanctuary AI
          </h2>
          <p className="text-[11px] text-stone-400 font-mono">
            Isolated Reflection
          </p>
        </div>
      </div>

      {/* New Reflection Quick CTA */}
      <div className="px-4 pt-4 pb-2">
        <button
          id="sidebar-new-reflection-btn"
          onClick={onNewReflection}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-medium text-sm transition shadow-sm cursor-pointer"
        >
          <PenSquare className="w-4 h-4" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id as NavTab)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-stone-800 text-amber-300 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-stone-800/80 bg-stone-950/40">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                className="w-8 h-8 rounded-full border border-stone-700 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 border border-stone-700 flex items-center justify-center text-xs font-semibold shrink-0">
                {profile?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-stone-200 truncate">
                {profile?.displayName || 'Reflector'}
              </p>
              <p className="text-[10px] text-stone-400 truncate">
                {profile?.email || 'Authenticated'}
              </p>
            </div>
          </div>

          <button
            id="sidebar-logout-btn"
            onClick={logOut}
            title="Sign Out"
            className="p-1.5 text-stone-400 hover:text-rose-300 hover:bg-stone-800 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
