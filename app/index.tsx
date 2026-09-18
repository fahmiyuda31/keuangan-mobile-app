import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { RootNavigator } from '@/navigation';
import { useAppStore, useTransactionStore, useCategoryStore, useBudgetStore } from '@/store';
import { seedDefaultCategories } from '@/services/dbService';
import { subscribeToAuth, isFirebaseConfigured } from '@/services/firebaseService';
import AuthScreen from '@/screens/AuthScreen';

LogBox.ignoreLogs(["Passing an object as the argument to 'navigate'"]);

export default function App() {
  const { theme } = useAppStore();
  const scheme = useColorScheme();
  const resolvedTheme = theme === 'system' ? (scheme ?? 'light') : theme;
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured() && Platform.OS !== 'web');
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await seedDefaultCategories();
        await Promise.all([
          useTransactionStore.getState().loadFromDb(),
          useCategoryStore.getState().loadFromDb(),
          useBudgetStore.getState().loadFromDb(),
        ]);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeApp();

    if (!isFirebaseConfigured() || Platform.OS === 'web') {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = subscribeToAuth((authUser) => {
      setUser(authUser ? authUser.uid : null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const showApp =
    !authLoading && (user !== null || !isFirebaseConfigured() || Platform.OS === 'web');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {showApp ? <RootNavigator /> : <AuthScreen />}
        <StatusBar
          style={resolvedTheme === 'dark' ? 'light' : 'dark'}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
