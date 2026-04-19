// src/navigation/EmployeeTabs.tsx
import React                          from 'react';
import { useColorScheme }             from 'react-native';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  MapPin,
  Camera,
  User,
  type LucideIcon,
}                                     from 'lucide-react-native';
import ReactNativeHapticFeedback      from 'react-native-haptic-feedback';

import TrackingScreen   from '../screens/employee/TrackingScreen';
import VisitPhotoScreen from '../screens/employee/VisitPhotoScreen';
import ProfileScreen    from '../screens/employee/ProfileScreen';

import TabIcon              from './TabIcon';
import { sharedTabOptions } from './sharedTabOptions';

const HAPTIC_OPTIONS = {
  enableVibrateFallback:       true,
  ignoreAndroidSystemSettings: false,
};

// ── Param lists ───────────────────────────────────────────────────
export type EmployeeTabParamList = {
  Tracking: undefined;
  LogVisit: undefined;
  Profile:  undefined;
};

export type EmployeeStackParamList = {
  EmployeeTabsRoot: undefined;
  // ✅ IncomingCall + EmployeeActiveCall removed — both live in RootStack
};

const Tab   = createBottomTabNavigator<EmployeeTabParamList>();
const Stack = createNativeStackNavigator<EmployeeStackParamList>();

function makeIcon(Icon: LucideIcon) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <TabIcon Icon={Icon} focused={focused} color={color} />
  );
}

function onTabPress() {
  ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
}

function EmployeeTabNavigator() {
  const scheme = useColorScheme();
  return (
    <Tab.Navigator
      screenOptions={sharedTabOptions(scheme)}
      screenListeners={{ tabPress: onTabPress }}
    >
      <Tab.Screen
        name="Tracking"
        component={TrackingScreen}
        options={{
          title:       'My Shift',
          tabBarLabel: 'Shift',
          tabBarIcon:  makeIcon(MapPin),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="LogVisit"
        component={VisitPhotoScreen}
        options={{
          title:       'Log Visit',
          tabBarLabel: 'Visit',
          tabBarIcon:  makeIcon(Camera),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title:       'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon:  makeIcon(User),
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

export default function EmployeeTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmployeeTabsRoot" component={EmployeeTabNavigator} />
    </Stack.Navigator>
  );
}