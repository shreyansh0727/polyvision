// src/components/tracking/TrackingHeader.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface Props {
  name?: string;
  onLogout: () => void;
}

const today = new Date().toLocaleDateString('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default function TrackingHeader({ name, onLogout }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.header,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.kicker}>TRACKING DASHBOARD</Text>
        <Text style={styles.greeting} numberOfLines={1}>
          Hello, {name ?? '…'} <Text style={styles.wave}>👋</Text>
        </Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <TouchableOpacity
        onPress={onLogout}
        style={styles.logoutBtn}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        activeOpacity={0.82}
      >
        <Text style={styles.logoutText}>⎋ Sign Out</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },

  left: { flex: 1, paddingRight: 8 },

  kicker: {
    fontSize: 9,
    fontWeight: '800',
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 1.6,
    marginBottom: 6,
  },

  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
    letterSpacing: 0.2,
  },

  wave: {
    fontSize: 20,
  },

  date: {
    fontSize: 11,
    color: MC.textSub,
    fontFamily: MF.mono,
    marginTop: 4,
  },

  logoutBtn: {
    backgroundColor: MC.surface,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  logoutText: {
    fontSize: 12,
    color: MC.rose,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 0.4,
  },
});