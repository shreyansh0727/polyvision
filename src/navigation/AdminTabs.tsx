// src/navigation/AdminTabs.tsx
import React                          from 'react';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Map,
  LayoutDashboard,
  Camera,
  Users,
  Bell,
  type LucideIcon,
}                                     from 'lucide-react-native';
import ReactNativeHapticFeedback      from 'react-native-haptic-feedback';

import LiveMapScreen     from '../screens/admin/LiveMapScreen';
import AdminScreen       from '../screens/admin/AdminScreen';
import AdminVisitsScreen from '../screens/admin/AdminVisitsScreen';
import EmployeesScreen   from '../screens/admin/EmployeesScreen';
import NotifyScreen      from '../screens/admin/NotifyScreen';
import CallScreen        from '../screens/admin/CallScreen';

import TabIcon              from './TabIcon';
import { sharedTabOptions } from './sharedTabOptions';

const HAPTIC_OPTIONS = {
  enableVibrateFallback:       true,
  ignoreAndroidSystemSettings: false,
};

// ── Param lists ───────────────────────────────────────────────────
export type AdminTabParamList = {
  LiveMap:   undefined;
  Dashboard: undefined;
  Visits:    undefined;
  Employees: undefined;
  Notify:    undefined;
};

export type AdminStackParamList = {
  AdminTabsRoot: undefined;
  Call: { employeeId: string; employeeName: string };
};

const Tab   = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

// ── Reusable icon factory ─────────────────────────────────────────
function makeIcon(Icon: LucideIcon) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <TabIcon Icon={Icon} focused={focused} color={color} />
  );
}

// ── Haptic tab press listener ─────────────────────────────────────
function onTabPress() {
  ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
}

// ── Tab navigator ─────────────────────────────────────────────────
function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={sharedTabOptions('dark')}
      screenListeners={{ tabPress: onTabPress }}
    >
      <Tab.Screen
        name="LiveMap"
        component={LiveMapScreen}
        options={{
          title:       'Live Map',
          tabBarLabel: 'Live Map',
          tabBarIcon:  makeIcon(Map),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={AdminScreen}
        options={{
          title:       'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon:  makeIcon(LayoutDashboard),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Visits"
        component={AdminVisitsScreen}
        options={{
          title:       'Visits',
          tabBarLabel: 'Visits',
          tabBarIcon:  makeIcon(Camera),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Employees"
        component={EmployeesScreen}
        options={{
          title:       'Employees',
          tabBarLabel: 'Team',
          tabBarIcon:  makeIcon(Users),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Notify"
        component={NotifyScreen}
        options={{
          title:       'Notify',
          tabBarLabel: 'Notify',
          tabBarIcon:  makeIcon(Bell),
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root stack (tabs + modal) ─────────────────────────────────────
export default function AdminTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabsRoot" component={AdminTabNavigator} />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{
          presentation:   'fullScreenModal',
          animation:      'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}