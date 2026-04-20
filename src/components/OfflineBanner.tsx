import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineStore } from '../store/offlineStore';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react-native';
import { MF } from '../navigation/AppTheme';

export function OfflineBanner(): React.ReactElement | null {
  const isOnline = useOfflineStore(s => s.isOnline);
  const queue    = useOfflineStore(s => s.queue);
  const insets   = useSafeAreaInsets();

  const slideAnim  = useRef(new Animated.Value(80)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const wasOnline  = useRef(true);

  // Hidden means user manually dismissed — stays hidden until connectivity changes again
  const [hidden, setHidden]       = useState(false);
  const hiddenRef                 = useRef(false);

  const slideOut = (then?: () => void) => {
    Animated.spring(slideAnim, {
      toValue: 80,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start(then);
  };

  const slideIn = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  };

  const dismiss = () => {
    hiddenRef.current = true;
    setHidden(true);
    slideOut();
  };

  // Pulsing dot loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotOpacity]);

  useEffect(() => {
    if (!isOnline) {
      // Connectivity dropped — always re-show, overriding any previous dismiss
      wasOnline.current = false;
      hiddenRef.current = false;
      setHidden(false);
      slideIn();
    } else {
      if (!wasOnline.current) {
        wasOnline.current = true;
        // Only show "back online" flash if user hadn't dismissed
        if (!hiddenRef.current) {
          Animated.sequence([
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
            Animated.delay(2200),
          ]).start(() => slideOut());
        }
        // Reset dismiss state once back online
        hiddenRef.current = false;
        setHidden(false);
      }
    }
  }, [isOnline]);

  const queueCount = queue.length;

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline ? styles.online : styles.offline,
        {
          bottom: insets.bottom + 12,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Pulsing dot */}
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

      {/* Badge pill */}
      <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
        {isOnline ? (
          queueCount > 0
            ? <RefreshCw size={11} color="#4ade80" />
            : <Wifi size={11} color="#4ade80" />
        ) : (
          <WifiOff size={11} color="#f87171" />
        )}
        <Text style={[styles.pillText, isOnline ? styles.pillTextOnline : styles.pillTextOffline]}>
          {isOnline ? (queueCount > 0 ? `${queueCount} queued` : 'Live') : 'Offline'}
        </Text>
      </View>

      {/* Dismiss — only shown while offline; auto-dismiss handles the online flash */}
      {!isOnline && (
        <TouchableOpacity
          style={[styles.closeBtn, styles.closeBtnOffline]}
          onPress={dismiss}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <X size={11} color="#f87171" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,           // tighter right so X doesn't push too far
    gap: 10,
    borderRadius: 14,
    borderWidth: 0.5,
  },

  offline: { backgroundColor: '#7f1d1d', borderColor: '#991b1b' },
  online:  { backgroundColor: '#14532d', borderColor: '#166534' },

  dot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0 },
  dotOffline: { backgroundColor: '#f87171' },
  dotOnline:  { backgroundColor: '#4ade80' },

  textBlock: { flex: 1 },
  title: { fontSize: 11, fontWeight: '700', fontFamily: MF.mono, letterSpacing: 0.4 },
  titleOffline: { color: '#fca5a5' },
  titleOnline:  { color: '#86efac' },
  sub: { fontSize: 10, fontFamily: MF.mono, marginTop: 2, opacity: 0.75 },
  subOffline: { color: '#fca5a5' },
  subOnline:  { color: '#86efac' },

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
  pillText: { fontSize: 9, fontWeight: '800', fontFamily: MF.mono, letterSpacing: 0.7 },
  pillTextOffline: { color: '#fca5a5' },
  pillTextOnline:  { color: '#86efac' },

  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  closeBtnOffline: { backgroundColor: '#450a0a' },
});