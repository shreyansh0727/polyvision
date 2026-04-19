// src/navigation/AuthStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';  // ✅ native stack
import LoginScreen from '../screens/auth/LoginScreen';


export type AuthStackParamList = {
  Login:          undefined;
  // ForgotPassword: undefined;  ← extend here
};


const Stack = createNativeStackNavigator<AuthStackParamList>();


export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
