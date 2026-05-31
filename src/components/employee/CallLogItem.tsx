// src/components/employee/CallLogItem.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Clock3,
} from 'lucide-react-native';
import type { CallLogRecord } from '../../types/inbox';

type Props = { item: CallLogRecord };

const STATUS_CONFIG = {
  answered: {
    Icon: PhoneCall,
    color: '#10B981',
    label: 'Answered',
  },
  missed: {
    Icon: PhoneMissed,
    color: '#EF4444',
    label: 'Missed',
  },
  rejected: {
    Icon: PhoneOff,
    color: '#F59E0B',
    label: 'Rejected',
  },
} as const;

function formatDuration(seconds: number): string {
  if (seconds === 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function CallLogItem({ item }: Props) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.Icon;

  return (
    <View style={styles.card}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: `${config.color}15` },
        ]}>
        <StatusIcon size={20} color={config.color} strokeWidth={2.2} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.caller}>{item.callerName}</Text>
          <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
        </View>

        <Text style={styles.phone}>{item.callerPhone || 'Unknown number'}</Text>

        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: `${config.color}18` }]}>
            <Text style={[styles.badgeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>

          {item.duration > 0 && (
            <View style={styles.durationWrap}>
              <Clock3 size={13} color="#6B7280" strokeWidth={2} />
              <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  caller: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  phone: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  durationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    fontSize: 12,
    color: '#6B7280',
  },
});