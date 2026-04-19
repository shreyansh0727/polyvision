// src/components/map/MapLegend.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

interface LegendItem {
  dot:   string;   // color
  label: string;
  count: number;
}

interface Props {
  onlineCount:  number;
  offlineCount: number;
  onPress?:     () => void;     // optional — tapping legend opens employee list
  style?:       ViewStyle;
}

export default function MapLegend({
  onlineCount,
  offlineCount,
  onPress,
  style,
}: Props) {
  // ── Slide down from top on mount ─────────────────────────────
  const slideY  = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue:         0,
        friction:        8,
        tension:         80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Animate count changes ─────────────────────────────────────
  const countScale = useRef(new Animated.Value(1)).current;

  const prevOnline = useRef(onlineCount);
  useEffect(() => {
    if (prevOnline.current === onlineCount) return;
    prevOnline.current = onlineCount;

    Animated.sequence([
      Animated.timing(countScale, {
        toValue:         1.3,
        duration:        150,
        useNativeDriver: true,
      }),
      Animated.timing(countScale, {
        toValue:         1,
        duration:        150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onlineCount]);

  const items: LegendItem[] = [
    { dot: '#437a22', label: 'Online',  count: onlineCount  },
    ...(offlineCount > 0
      ? [{ dot: '#7a7974', label: 'Offline', count: offlineCount }]
      : []
    ),
  ];

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideY }], opacity },
        style,
      ]}
    >
      <Wrapper
        style={styles.pill}
        {...(onPress ? { onPress, activeOpacity: 0.8 } : {})}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.label}>

            {/* Divider between items */}
            {index > 0 && <View style={styles.divider} />}

            {/* Legend item */}
            <View style={styles.item}>
              {/* Status dot */}
              <View style={[styles.dot, { backgroundColor: item.dot }]} />

              {/* Count — animates on change */}
              <Animated.Text style={[
                styles.count,
                index === 0 && { transform: [{ scale: countScale }] },
              ]}>
                {item.count}
              </Animated.Text>

              {/* Label */}
              <Text style={styles.label}>{item.label}</Text>
            </View>

          </React.Fragment>
        ))}

        {/* Chevron if tappable */}
        {onPress && (
          <Text style={styles.chevron}>›</Text>
        )}
      </Wrapper>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top:      16,
    right:    16,
    zIndex:   10,
  },

  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#fff',
    borderRadius:    999,
    paddingVertical:   8,
    paddingHorizontal: 14,
    gap:             10,
    shadowColor:     '#000',
    shadowOpacity:   0.12,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },

  // Each item
  item:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  count: { fontSize: 14, fontWeight: '700', color: '#28251d' },
  label: { fontSize: 13, color: '#7a7974', fontWeight: '500' },

  // Divider between online/offline
  divider: {
    width:           1,
    height:          14,
    backgroundColor: '#dcd9d5',
    marginHorizontal: 2,
  },

  // Chevron
  chevron: {
    fontSize:   18,
    color:      '#7a7974',
    fontWeight: '300',
    marginLeft: 2,
  },
});