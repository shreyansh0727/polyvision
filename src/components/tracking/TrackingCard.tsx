// src/components/tracking/TrackingCard.tsx
import React, { useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { MC, MF } from '../../navigation/AppTheme';

interface LastLocation {
  lat:       number;
  lng:       number;
  accuracy?: number | null;
}

interface Props {
  isTracking:     boolean;
  isStarting:     boolean;
  isStopping:     boolean;
  error?:         string | null;
  lastLocation?:  LastLocation | null;
  onToggle:       (value: boolean) => void;
  onDismissError: () => void;
}

function statusLabel(isStarting: boolean, isStopping: boolean, isTracking: boolean): string {
  if (isStarting) return 'Starting tracking…';
  if (isStopping) return 'Stopping tracking…';
  if (isTracking) return 'Active — location is being shared';
  return 'Inactive — tap to start your shift';
}

const PulseDot = memo(function PulseDot({
  color = MC.green,
  size = 8,
}: { color?: string; size?: number }) {
  const ring = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring, { toValue: 2.1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.4,
          borderColor: color,
          transform: [{ scale: ring }],
          opacity: ringOpacity,
        }}
      />
      <View
        style={{
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
    </View>
  );
});

export default function TrackingCard({
  isTracking,
  isStarting,
  isStopping,
  error,
  lastLocation,
  onToggle,
  onDismissError,
}: Props) {
  const switchDisabled = isStarting || isStopping;
  const activeColor = isTracking ? MC.green : MC.textFaint;
  const activeBg = isTracking ? MC.greenDim : MC.surfaceAlt;

  return (
    <View style={styles.card}>
      {/* Accent top bar */}
      <View style={[styles.accentBar, { backgroundColor: activeColor }]} />

      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.titleWrap}>
            <Text style={styles.kicker}>SHIFT CONTROL</Text>
            <Text style={styles.cardTitle}>Location Tracking</Text>
          </View>

          {switchDisabled ? (
            <ActivityIndicator size="small" color={MC.green} />
          ) : (
            <Switch
              value={isTracking}
              onValueChange={onToggle}
              disabled={switchDisabled}
              trackColor={{ false: MC.borderBright, true: MC.greenGlow }}
              thumbColor={isTracking ? MC.green : MC.textSub}
              ios_backgroundColor={MC.borderBright}
            />
          )}
        </View>

        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: activeBg, borderColor: activeColor }]}>
          {isTracking ? (
            <PulseDot color={MC.green} size={8} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: MC.textFaint }]} />
          )}

          <Text style={[styles.statusText, { color: activeColor }]}>
            {statusLabel(isStarting, isStopping, isTracking)}
          </Text>
        </View>

        {/* Coordinates */}
        {lastLocation && (
          <View style={styles.coordsCard}>
            <View style={styles.coordsHeader}>
              <Text style={styles.coordsLabel}>LAST LOCATION</Text>
              {lastLocation.accuracy != null && (
                <View style={styles.coordsAccuracyBadge}>
                  <Text style={styles.coordsAccuracyText}>
                    ±{Math.round(lastLocation.accuracy)}m
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.coordsText}>
              {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
            </Text>
          </View>
        )}

        {/* Error box */}
        {error && (
          <TouchableOpacity
            style={styles.errorBox}
            onPress={onDismissError}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
            activeOpacity={0.82}
          >
            <View style={styles.errorHeader}>
              <Text style={styles.errorTitle}>⚠ Tracking Error</Text>
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MC.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },

  accentBar: { height: 3 },

  inner: { padding: 18 },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  titleWrap: { flex: 1, paddingRight: 12 },

  kicker: {
    fontSize: 9,
    fontWeight: '800',
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 1.6,
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
  },

  statusPill: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    fontFamily: MF.mono,
    lineHeight: 17,
  },

  coordsCard: {
    marginTop: 14,
    backgroundColor: MC.surfaceAlt,
    borderWidth: 1,
    borderColor: MC.border,
    borderRadius: 14,
    padding: 12,
  },

  coordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  coordsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 1.4,
  },

  coordsText: {
    fontSize: 13,
    color: MC.textPrimary,
    fontFamily: MF.mono,
  },

  coordsAccuracyBadge: {
    backgroundColor: MC.blueDim,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: MC.blue + '44',
  },

  coordsAccuracyText: {
    fontSize: 9,
    color: MC.blue,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 0.5,
  },

  errorBox: {
    marginTop: 14,
    backgroundColor: MC.roseDim,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: MC.rose + '44',
  },

  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  errorTitle: {
    color: MC.rose,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 0.4,
  },

  errorDismiss: {
    color: MC.textSub,
    fontSize: 10,
    fontFamily: MF.mono,
  },

  errorText: {
    color: '#F7D7E4',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: MF.mono,
  },
});