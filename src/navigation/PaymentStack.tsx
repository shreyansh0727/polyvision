import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PaymentScreen from '../screens/auth/TenantSetupScreen';

export type PaymentStackParamList = {
  Payment: undefined;
};

const Stack = createNativeStackNavigator<PaymentStackParamList>();

export default function PaymentStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Payment" component={PaymentScreen} />
    </Stack.Navigator>
  );
}