import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useOfflineStore } from '../store/offlineStore';
import { WifiOff, WifiHigh, RefreshCcw } from 'lucide-react-native';

/**
 * Drop inside your root layout (App.tsx), above the navigator.
 * Shows a red "No internet" bar when offline, green "Back online" flash when reconnected.
 */
export function OfflineBanner(): React.ReactElement | null {
  const isOnline = useOfflineStore(s => s.isOnline);
  const queue = useOfflineStore(s => s.queue);
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const wasOnline = useRef(true);

  useEffect(() => {
    if (!isOnline) {
      wasOnline.current = false;
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    } else {
      if (!wasOnline.current) {
        Animated.sequence([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }),
          Animated.delay(2000),
          Animated.spring(slideAnim, { toValue: -50, useNativeDriver: true }),
        ]).start();
        wasOnline.current = true;
      }
    }
  }, [isOnline, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline ? styles.online : styles.offline,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {isOnline ? (
        <View style={styles.row}>
          <WifiHigh size={14} color="#fff" />
          <RefreshCcw size={14} color="#fff" style={{ marginLeft: 6 }} />
          <Text style={styles.text}>
            Back online — syncing {queue.length} item{queue.length === 1 ? '' : 's'}
          </Text>
        </View>
      ) : (
        <View style={styles.row}>
          <WifiOff size={14} color="#fff" />
          <Text style={styles.text}>
            No internet —{' '}
            {queue.length > 0
              ? `${queue.length} action${queue.length === 1 ? '' : 's'} queued`
              : 'working offline'}
          </Text>
        </View>
      )}
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offline: { backgroundColor: '#c0392b' },
  online: { backgroundColor: '#27ae60' },
  text: { color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 6 },
});