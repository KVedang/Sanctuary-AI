import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { JournalEditor } from './components/editor/JournalEditor';
import { HistoryList } from './components/history/HistoryList';
import { AskMyJournal } from './components/ask/AskMyJournal';
import { GoalList } from './components/goals/GoalList';
import { InsightsView } from './components/insights/InsightsView';
import { SettingsView } from './components/settings/SettingsView';
import { AiAssistant } from './components/assistant/AiAssistant';
import { JournalEntry, Goal } from './types';
import { db, verifyFirestoreConnection } from './lib/firebase';
import { parseFirestoreDate } from './lib/utils';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Firestore connection test required by standard
  useEffect(() => {
    verifyFirestoreConnection();
  }, []);

  // Real-time Firestore Listeners strictly bound to `users/{uid}/*`
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setGoals([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    // 1. Listen to user's journals
    const journalsRef = collection(db, 'users', user.uid, 'journals');
    const unsubJournals = onSnapshot(
      journalsRef,
      (snapshot) => {
        const loaded: JournalEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loaded.push({
            id: doc.id,
            userId: user.uid,
            title: data.title || '',
            content: data.content || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            mood: data.mood,
            isFavorite: !!data.isFavorite,
            isPinned: !!data.isPinned,
            isArchived: !!data.isArchived,
            aiSummary: data.aiSummary,
            extractedActionItems: data.extractedActionItems,
            wordCount: data.wordCount || 0,
            createdAt: parseFirestoreDate(data.createdAt),
            updatedAt: parseFirestoreDate(data.updatedAt),
          });
        });

        // Sort: pinned first, then newest
        loaded.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        setEntries(loaded);
        setDataLoading(false);
      },
      (error) => {
        console.error('Error listening to journals:', error);
        setDataLoading(false);
      }
    );

    // 2. Listen to user's goals
    const goalsRef = collection(db, 'users', user.uid, 'goals');
    const unsubGoals = onSnapshot(
      goalsRef,
      (snapshot) => {
        const loaded: Goal[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loaded.push({
            id: doc.id,
            userId: user.uid,
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || 'medium',
            status: data.status || 'in_progress',
            progress: data.progress ?? 0,
            tasks: Array.isArray(data.tasks) ? data.tasks : [],
            createdAt: parseFirestoreDate(data.createdAt),
            updatedAt: parseFirestoreDate(data.updatedAt),
          });
        });
        setGoals(loaded);
      },
      (error) => {
        console.error('Error listening to goals:', error);
      }
    );

    return () => {
      unsubJournals();
      unsubGoals();
    };
  }, [user]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-xs font-serif text-stone-600">Sanctuary AI Reflection Space...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing Page
  if (!user) {
    return <LandingPage />;
  }

  const handleSelectEntryForEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setCurrentTab('editor');
  };

  const handleNewReflection = () => {
    setEditingEntry(null);
    setCurrentTab('editor');
  };

  const handleAssistantConvertToJournal = (title: string, content: string) => {
    setEditingEntry({
      id: '',
      userId: user?.uid || '',
      title,
      content,
      tags: ['ai-reflection'],
      isFavorite: false,
      isPinned: false,
      isArchived: false,
      wordCount: content.split(/\s+/).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCurrentTab('editor');
  };

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden font-sans antialiased text-stone-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'editor') {
            setEditingEntry(null);
          }
          setCurrentTab(tab);
        }}
        onNewReflection={handleNewReflection}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto">
        {currentTab === 'dashboard' && (
          <DashboardOverview
            entries={entries}
            goals={goals}
            onSelectEntry={handleSelectEntryForEdit}
            onNewReflection={handleNewReflection}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'assistant' && (
          <AiAssistant
            entries={entries}
            onConvertToJournal={handleAssistantConvertToJournal}
          />
        )}

        {currentTab === 'editor' && (
          <JournalEditor
            initialEntry={editingEntry}
            onBack={() => setCurrentTab('history')}
            onSaved={() => {
              // Stay in editor or go to history
            }}
          />
        )}

        {currentTab === 'history' && (
          <HistoryList
            entries={entries}
            onSelectEntry={handleSelectEntryForEdit}
            onNewReflection={handleNewReflection}
          />
        )}

        {currentTab === 'ask' && (
          <AskMyJournal
            entries={entries}
            onSelectEntry={handleSelectEntryForEdit}
          />
        )}

        {currentTab === 'goals' && (
          <GoalList
            goals={goals}
            onRefresh={() => {}}
          />
        )}

        {currentTab === 'insights' && (
          <InsightsView
            entries={entries}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            entries={entries}
            goals={goals}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
