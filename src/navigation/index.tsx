import React, { useState, useCallback, useEffect } from 'react';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IRtcEngine } from 'react-native-agora';

import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { navigationRef } from './navigationRef';
import { LightTheme, AppDarkTheme } from './AppTheme';

import SplashScreen from './SplashScreen';
import AuthStack from './AuthStack';
import EmployeeTabs from './EmployeeTabs';
import AdminTabs from './AdminTabs';
import PaymentStack from './PaymentStack';

import IncomingCallScreen from '../screens/employee/IncomingCallScreen';
import EmployeeActiveCallScreen from '../screens/employee/EmployeeActiveCallScreen';
import { pendingCall } from '../utils/pendingCall';

export type RootStackParamList = {
  App: undefined;
  IncomingCall: {
    channel: string;
    token: string;
    appId: string;
    callerName: string;
    callerId: string;
  };
  EmployeeActiveCall: {
    channel: string;
    callerName: string;
    engine: IRtcEngine;
  };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const employee = useAuthStore(s => s.employee);
  const needsTenantSetup = useAuthStore(s => s.needsTenantSetup);
  const needsPayment = useAuthStore(s => s.needsPayment);

  if (!isAuthenticated) return <AuthStack />;

  if (!employee?.role) {
    console.warn('[Nav] Authenticated but role is missing:', employee);
    return <AuthStack />;
  }

  // Admin activation gate:
  // 1. no tenant yet
  // 2. tenant exists but payment not active
  if (employee.role === 'admin' && (needsTenantSetup() || needsPayment())) {
    return <PaymentStack />;
  }

  return employee.role === 'admin' ? <AdminTabs /> : <EmployeeTabs />;
}

function NavigationBootstrap() {
  useNotifications();
  return null;
}

async function consumePendingCall(label: string): Promise<void> {
  try {
    const data = await pendingCall.get();
    if (!data) return;

    if (data.type !== 'call_invite' || !data.channel || !data.token || !data.app_id) {
      await pendingCall.clear();
      return;
    }

    await pendingCall.clear();
    console.log(`[Nav] ${label}: consuming pendingCall →`, data.caller_name);

    if (navigationRef.isReady()) {
      navigationRef.navigate('IncomingCall', {
        channel: data.channel ?? '',
        token: data.token ?? '',
        appId: data.app_id ?? '',
        callerName: data.caller_name ?? 'Admin',
        callerId: data.caller_id ?? '',
      });
    }
  } catch (e) {
    console.warn('[Nav] consumePendingCall error:', e);
  }
}

export default function Navigation() {
  const loading = useAuthStore(s => s.loading);
  const scheme = useColorScheme();

  const [splashDone, setSplashDone] = useState(false);

  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  const handleReady = useCallback(() => {
    consumePendingCall('onReady');
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        consumePendingCall('AppState→active');
      }
    });

    return () => sub.remove();
  }, []);

  if (!splashDone || loading) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={scheme === 'dark' ? AppDarkTheme : LightTheme}
      onReady={handleReady}
    >
      <NavigationBootstrap />

      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="App" component={AppNavigator} />

        <RootStack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />

        <RootStack.Screen
          name="EmployeeActiveCall"
          component={EmployeeActiveCallScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}