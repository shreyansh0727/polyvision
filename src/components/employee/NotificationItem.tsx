// src/components/employee/NotificationItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, Circle } from 'lucide-react-native';
import type { NotificationRecord } from '../../types/inbox';

type Props = {
  item: NotificationRecord;
  onRead: (id: string) => void;
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationItem({ item, onRead }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => !item.read && onRead(item.id)}
      activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconBadge, !item.read && styles.iconBadgeUnread]}>
          <Bell
            size={18}
            color={!item.read ? '#6366F1' : '#6B7280'}
            strokeWidth={2.2}
          />
        </View>

        {!item.read && (
          <View style={styles.dot}>
            <Circle size={8} fill="#6366F1" color="#6366F1" />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.sentAt)}</Text>
        </View>

        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>

        <Text style={styles.sender}>From {item.sentBy}</Text>
      </View>
    </TouchableOpacity>
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
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  iconWrap: {
    position: 'relative',
    marginRight: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeUnread: {
    backgroundColor: '#EEF2FF',
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
  },
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  body: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 6,
  },
  sender: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
});