import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useOfflineStore } from '../store/offlineStore';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react-native';
import { MC, MF } from '../navigation/AppTheme';

export function OfflineBanner(): React.ReactElement | null {
  const isOnline = useOfflineStore(s => s.isOnline);
  const queue    = useOfflineStore(s => s.queue);

  const slideAnim  = useRef(new Animated.Value(-60)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const wasOnline  = useRef(true);

  // Pulsing dot loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotOpacity]);

  useEffect(() => {
    if (!isOnline) {
      wasOnline.current = false;
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      if (!wasOnline.current) {
        // Show "back online" briefly, then slide out
        Animated.sequence([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
          Animated.delay(2200),
          Animated.spring(slideAnim, { toValue: -60, useNativeDriver: true, damping: 22, stiffness: 180 }),
        ]).start();
        wasOnline.current = true;
      }
    }
  }, [isOnline, slideAnim]);

  const queueCount = queue.length;

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline ? styles.online : styles.offline,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Pulsing status dot */}
      <Animated.View
        style={[
          styles.dot,
          isOnline ? styles.dotOnline : styles.dotOffline,
          { opacity: dotOpacity },
        ]}
      />

      {/* Text block */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, isOnline ? styles.titleOnline : styles.titleOffline]}>
          {isOnline ? 'Back online' : 'No internet connection'}
        </Text>
        <Text style={[styles.sub, isOnline ? styles.subOnline : styles.subOffline]}>
          {isOnline
            ? queueCount > 0
              ? `Syncing ${queueCount} queued action${queueCount === 1 ? '' : 's'}…`
              : 'All changes synced'
            : queueCount > 0
              ? `${queueCount} action${queueCount === 1 ? '' : 's'} queued`
              : 'Working offline'}
        </Text>
      </View>

      {/* Icon + badge pill */}
      <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
        {isOnline ? (
          queueCount > 0
            ? <RefreshCw size={11} color={isOnline ? '#4ade80' : '#f87171'} style={styles.pillIcon} />
            : <Wifi size={11} color="#4ade80" style={styles.pillIcon} />
        ) : (
          <WifiOff size={11} color="#f87171" style={styles.pillIcon} />
        )}
        <Text style={[styles.pillText, isOnline ? styles.pillTextOnline : styles.pillTextOffline]}>
          {isOnline
            ? queueCount > 0 ? `${queueCount} queued` : 'Live'
            : 'Offline'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 10,
  },

  // ── State backgrounds ───────────────────────────────────
  offline: {
    backgroundColor: '#7f1d1d',
    borderBottomWidth: 0.5,
    borderBottomColor: '#991b1b',
  },
  online: {
    backgroundColor: '#14532d',
    borderBottomWidth: 0.5,
    borderBottomColor: '#166534',
  },

  // ── Pulsing dot ─────────────────────────────────────────
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
  },
  dotOffline: { backgroundColor: '#f87171' },
  dotOnline:  { backgroundColor: '#4ade80' },

  // ── Text block ──────────────────────────────────────────
  textBlock: { flex: 1 },
  title: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: MF.mono,
    letterSpacing: 0.4,
  },
  titleOffline: { color: '#fca5a5' },
  titleOnline:  { color: '#86efac' },
  sub: {
    fontSize: 10,
    fontFamily: MF.mono,
    marginTop: 2,
    opacity: 0.75,
  },
  subOffline: { color: '#fca5a5' },
  subOnline:  { color: '#86efac' },

  // ── Badge pill ──────────────────────────────────────────
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    gap: 5,
    flexShrink: 0,
  },
  pillOffline: { backgroundColor: '#450a0a' },
  pillOnline:  { backgroundColor: '#052e16' },
  pillIcon: {},
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 0.7,
  },
  pillTextOffline: { color: '#fca5a5' },
  pillTextOnline:  { color: '#86efac' },
});