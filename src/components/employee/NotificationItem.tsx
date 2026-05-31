// src/components/employee/NotificationItem.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import type { NotificationRecord } from '../../types/inbox';
import { MC } from '../../navigation/AppTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  item:   NotificationRecord;
  onRead: (id: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const isTablet = SCREEN_W >= 768;

function timeAgo(iso: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return '—';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationItem({ item, onRead }: Props) {
  const glowAnim  = useRef(new Animated.Value(item.read ? 0 : 1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // Pulse the unread indicator once on mount for new items
  useEffect(() => {
    if (item.read) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    );
    pulse.start();
    return () => pulse.stop();
  }, [item.read, glowAnim]);

  const handlePressIn = () =>
    Animated.spring(pressAnim, { toValue: 0.98, useNativeDriver: true }).start();

  const handlePressOut = () =>
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true }).start();

  const handlePress = () => {
    if (!item.read) onRead(item.id);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Notification: ${item.title}. ${item.read ? 'Read' : 'Unread'}`}
      accessibilityState={{ selected: !item.read }}
    >
      <Animated.View
        style={[
          styles.card,
          !item.read && styles.cardUnread,
          { transform: [{ scale: pressAnim }] },
        ]}
      >
        {/* Left accent bar (unread only) */}
        {!item.read && <View style={styles.accentBar} />}

        {/* Icon column */}
        <View style={styles.iconCol}>
          <Animated.View
            style={[
              styles.iconRing,
              !item.read && styles.iconRingUnread,
              !item.read && { opacity: glowAnim },
            ]}
          >
            <Bell
              size={16}
              color={item.read ? MC.textSub : MC.green}
              strokeWidth={2}
            />
          </Animated.View>

          {!item.read && <View style={styles.unreadDot} />}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>
            <Text style={styles.time}>{timeAgo(item.sentAt)}</Text>
          </View>

          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>

          <View style={styles.footer}>
            <View style={styles.senderChip}>
              <Text style={styles.senderText}>from {item.sentBy}</Text>
            </View>
            {!item.read && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>NEW</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    backgroundColor:  MC.surface,
    borderRadius:     14,
    marginBottom:     8,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      MC.border,
    paddingVertical:  14,
    paddingRight:     14,
    paddingLeft:      isTablet ? 16 : 12,
  },
  cardUnread: {
    backgroundColor: MC.surfaceAlt,
    borderColor:     `${MC.green}35`,
  },

  // Accent bar
  accentBar: {
    position:        'absolute',
    left:            0,
    top:             10,
    bottom:          10,
    width:           3,
    borderRadius:    2,
    backgroundColor: MC.green,
  },

  // Icon
  iconCol: {
    alignItems:  'center',
    marginLeft:  10,
    marginRight: 12,
    paddingTop:  2,
    gap:         6,
  },
  iconRing: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: MC.surfaceLift,
    borderWidth:     1,
    borderColor:     MC.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconRingUnread: {
    backgroundColor: MC.greenDim,
    borderColor:     `${MC.green}40`,
  },
  unreadDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: MC.green,
  },

  // Content
  content: { flex: 1, gap: 5 },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            8,
  },
  title: {
    flex:       1,
    fontSize:   isTablet ? 15 : 14,
    fontWeight: '700',
    color:      MC.textPrimary,
    lineHeight: 20,
  },
  time: {
    fontSize:    11,
    color:       MC.textSub,
    flexShrink:  0,
  },
  body: {
    fontSize:   isTablet ? 14 : 13,
    color:      MC.textSub,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginTop:     2,
  },
  senderChip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
    backgroundColor:   MC.surfaceLift,
  },
  senderText: {
    fontSize:   11,
    fontWeight: '600',
    color:      MC.textSub,
  },
  unreadBadge: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      6,
    backgroundColor:   MC.greenDim,
    borderWidth:       1,
    borderColor:       `${MC.green}40`,
  },
  unreadBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    color:         MC.green,
    letterSpacing: 1,
  },
});