import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { TabParamList } from './types';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import TransactionsScreen from '@/screens/transactions/TransactionsScreen';
import CategoriesScreen from '@/screens/categories/CategoriesScreen';
import BudgetsScreen from '@/screens/budgets/BudgetsScreen';
import AIChatScreen from '@/screens/ai/AIChatScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

export function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const t = useT();

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: RouteProp<TabParamList, keyof TabParamList> }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.screen,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 64 + (insets.bottom > 0 ? insets.bottom : 0),
          paddingTop: 8,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', paddingBottom: 2 },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Transactions':
              iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
              break;
            case 'Categories':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Budgets':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'AIChat':
              iconName = focused ? 'sparkles' : 'sparkles-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'square';
          }

          return (
            <View
              style={[
                styles.iconPill,
                {
                  backgroundColor: focused ? colors.primary : 'transparent',
                },
              ]}
            >
              <Ionicons name={iconName} size={size} color={focused ? '#ffffff' : color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: t('dashboard'),
          tabBarLabel: t('dashboard'),
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          title: t('transactions'),
          tabBarLabel: t('transactions'),
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          title: t('categories'),
          tabBarLabel: t('categories'),
        }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{
          title: t('budgets'),
          tabBarLabel: t('budgets'),
        }}
      />
      <Tab.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          title: 'AI Chat',
          tabBarLabel: 'AI Chat',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings'),
          tabBarLabel: t('settings'),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 40,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
