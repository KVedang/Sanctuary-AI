import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  googleProvider, 
  auth, 
  db 
} from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserSettings } from '../types';
import { sanitizePayload, parseFirestoreDate } from '../lib/utils';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  getIdToken: () => Promise<string | null>;
  deleteUserAccountData: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  theme: 'light',
  aiAnalysisAllowed: true,
  saveAiResponses: true,
  useHistoryForAsk: true,
  autoSummaries: true,
  dailyReminderEnabled: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Reflector',
              photoURL: currentUser.photoURL || undefined,
              createdAt: parseFirestoreDate(data.createdAt),
              lastLoginAt: new Date().toISOString(),
              settings: { ...defaultSettings, ...(data.settings || {}) },
            });
            // Update last login
            await setDoc(userDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
          } else {
            // New user registration
            const nowIso = new Date().toISOString();
            const newProfile: UserProfile = {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Reflector',
              photoURL: currentUser.photoURL || undefined,
              createdAt: nowIso,
              lastLoginAt: nowIso,
              settings: defaultSettings,
            };
            await setDoc(userDocRef, sanitizePayload(newProfile));
            setProfile(newProfile);
          }
        } catch (error) {
          console.error('Error syncing user profile in Firestore:', error);
          // Fallback minimal profile so user can proceed
          setProfile({
            userId: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'Reflector',
            photoURL: currentUser.photoURL || undefined,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            settings: defaultSettings,
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      setLoading(false);
      throw error;
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user || !profile) return;
    const merged = { ...profile.settings, ...newSettings };
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { settings: merged }, { merge: true });
    setProfile(prev => prev ? { ...prev, settings: merged } : null);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    return await user.getIdToken();
  };

  const deleteUserAccountData = async () => {
    if (!user) return;
    const token = await getIdToken();
    if (!token) throw new Error('Unauthenticated');

    const res = await fetch('/api/user/purge', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to delete account data');
    }

    await logOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signInWithGoogle,
      logOut,
      updateSettings,
      getIdToken,
      deleteUserAccountData,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
