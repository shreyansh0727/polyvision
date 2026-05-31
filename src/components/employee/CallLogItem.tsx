// src/components/employee/CallLogItem.tsx
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import {
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Clock3,
} from 'lucide-react-native';
import type { CallLogRecord } from '../../types/inbox';
import { MC } from '../../navigation/AppTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const isTablet = SCREEN_W >= 768;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  answered: {
    Icon:   PhoneCall,
    color:  MC.green,
    dimBg:  MC.greenDim,
    border: `${MC.green}35`,
    label:  'Answered',
  },
  missed: {
    Icon:   PhoneMissed,
    color:  MC.rose,
    dimBg:  MC.roseDim,
    border: `${MC.rose}35`,
    label:  'Missed',
  },
  rejected: {
    Icon:   PhoneOff,
    color:  MC.gold,
    dimBg:  MC.goldDim,
    border: `${MC.gold}35`,
    label:  'Rejected',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

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

type Props = { item: CallLogRecord };

export function CallLogItem({ item }: Props) {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const cfg       = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.missed;
  const StatusIcon = cfg.Icon;

  const handlePressIn  = () =>
    Animated.spring(pressAnim, { toValue: 0.98, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(pressAnim, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Call log: ${item.callerName}, ${cfg.label}`}
    >
      <Animated.View
        style={[
          styles.card,
          { borderLeftColor: cfg.color, transform: [{ scale: pressAnim }] },
        ]}
      >
        {/* Status accent bar */}
        <View style={[styles.accentBar, { backgroundColor: cfg.color }]} />

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.dimBg, borderColor: cfg.border }]}>
          <StatusIcon size={18} color={cfg.color} strokeWidth={2} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.callerName} numberOfLines={1} ellipsizeMode="tail">
              {item.callerName || 'Unknown caller'}
            </Text>
            <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
          </View>

          <Text style={styles.phone} numberOfLines={1}>
            {item.callerPhone || 'Unknown number'}
          </Text>

          <View style={styles.metaRow}>
            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: cfg.dimBg, borderColor: cfg.border }]}>
              <StatusIcon size={10} color={cfg.color} strokeWidth={2.5} />
              <Text style={[styles.statusText, { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </View>

            {/* Duration */}
            {item.duration > 0 && (
              <View style={styles.durationRow}>
                <Clock3 size={12} color={MC.textSub} strokeWidth={2} />
                <Text style={styles.durationText}>
                  {formatDuration(item.duration)}
                </Text>
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
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: MC.surface,
    borderRadius:    14,
    marginBottom:    8,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     MC.border,
    paddingVertical: 14,
    paddingRight:    14,
    paddingLeft:     isTablet ? 16 : 12,
    gap:             12,
  },

  accentBar: {
    position:     'absolute',
    left:         0,
    top:          10,
    bottom:       10,
    width:        3,
    borderRadius: 2,
  },

  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    12,
    marginLeft:      8,
    borderWidth:     1,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  content: { flex: 1, gap: 4 },

  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            8,
  },
  callerName: {
    flex:       1,
    fontSize:   isTablet ? 15 : 14,
    fontWeight: '700',
    color:      MC.textPrimary,
  },
  time: {
    fontSize:   11,
    color:      MC.textSub,
    flexShrink: 0,
  },
  phone: {
    fontSize: isTablet ? 13 : 12,
    color:    MC.textSub,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     2,
    flexWrap:      'wrap',
  },
  statusBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      8,
    borderWidth:       1,
  },
  statusText: {
    fontSize:   11,
    fontWeight: '700',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  durationText: {
    fontSize:   12,
    color:      MC.textSub,
    fontWeight: '500',
  },
});