import { Tabs } from 'expo-router';
import React from 'react';
import { LayoutDashboard, User, Users } from 'lucide-react-native';

import { Brand } from '@/components/brand';
import { HapticTab } from '@/components/haptic-tab';
import { useColors } from '@/hooks/use-colors';

export default function TabLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        headerTitle: () => <Brand />,
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerStyle: { borderBottomWidth: 1, borderBottomColor: colors.border },
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Overpass_500Medium', fontSize: 11 },
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}
