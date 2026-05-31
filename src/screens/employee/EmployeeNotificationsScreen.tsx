import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Bell,
  Phone,
  Inbox,
  CheckCheck,
  Trash2,
} from 'lucide-react-native';

import { NotificationItem } from '../../components/employee/NotificationItem';
import { CallLogItem } from '../../components/employee/CallLogItem';

export type NotificationRecord = {
  id: string;
  type: 'notification';
  title: string;
  body: string;
  sentBy: string;
  sentAt: string;
  read: boolean;
};

export type CallLogRecord = {
  id: string;
  type: 'call';
  callerName: string;
  callerPhone: string;
  duration: number;
  status: 'answered' | 'missed' | 'rejected';
  timestamp: string;
};

type TabType = 'all' | 'notifications' | 'calls';

const NOTIF_STORAGE_KEY = 'employee_notifications';
const CALL_LOG_STORAGE_KEY = 'employee_call_logs';

export default function EmployeeNotificationsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rawNotifs, rawCalls] = await Promise.all([
        AsyncStorage.getItem(NOTIF_STORAGE_KEY),
        AsyncStorage.getItem(CALL_LOG_STORAGE_KEY),
      ]);

      const parsedNotifs: NotificationRecord[] = rawNotifs ? JSON.parse(rawNotifs) : [];
      const parsedCalls: CallLogRecord[] = rawCalls ? JSON.parse(rawCalls) : [];

      setNotifications(
        [...parsedNotifs].sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        ),
      );

      setCallLogs(
        [...parsedCalls].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      );
    } catch (e) {
      console.warn('[EmployeeNotifications] Failed to load data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const markAllRead = async () => {
    try {
      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[EmployeeNotifications] Failed to mark all read:', e);
    }
  };

  const clearAll = () => {
    Alert.alert(
      'Clear inbox',
      activeTab === 'all'
        ? 'This will remove all notifications and call logs.'
        : activeTab === 'notifications'
        ? 'This will remove all notifications.'
        : 'This will remove all call logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTab === 'notifications' || activeTab === 'all') {
                setNotifications([]);
                await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify([]));
              }

              if (activeTab === 'calls' || activeTab === 'all') {
                setCallLogs([]);
                await AsyncStorage.setItem(CALL_LOG_STORAGE_KEY, JSON.stringify([]));
              }
            } catch (e) {
              console.warn('[EmployeeNotifications] Failed to clear data:', e);
            }
          },
        },
      ],
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const combinedList = useMemo(() => {
    if (activeTab === 'notifications') return notifications;
    if (activeTab === 'calls') return callLogs;

    const merged: (NotificationRecord | CallLogRecord)[] = [...notifications, ...callLogs];

    return merged.sort((a, b) => {
      const dateA = a.type === 'notification' ? a.sentAt : a.timestamp;
      const dateB = b.type === 'notification' ? b.sentAt : b.timestamp;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [activeTab, notifications, callLogs]);

  const handleRead = async (id: string) => {
    try {
      const updated = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n,
      );
      setNotifications(updated);
      await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[EmployeeNotifications] Failed to update notification:', e);
    }
  };

  const renderItem = ({
    item,
  }: {
    item: NotificationRecord | CallLogRecord;
  }) => {
    if (item.type === 'notification') {
      return <NotificationItem item={item} onRead={handleRead} />;
    }

    return <CallLogItem item={item} />;
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        {activeTab === 'calls' ? (
          <Phone size={34} color="#6366F1" strokeWidth={2.2} />
        ) : activeTab === 'notifications' ? (
          <Bell size={34} color="#6366F1" strokeWidth={2.2} />
        ) : (
          <Inbox size={34} color="#6366F1" strokeWidth={2.2} />
        )}
      </View>
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'calls'
          ? 'Call logs from admin will appear here.'
          : activeTab === 'notifications'
          ? 'Notifications from admin will appear here.'
          : 'Notifications and call logs will appear here.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inbox</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && activeTab !== 'calls' && (
            <TouchableOpacity style={styles.actionBtn} onPress={markAllRead}>
              <CheckCheck size={14} color="#6366F1" />
              <Text style={styles.actionBtnText}>Mark all read</Text>
            </TouchableOpacity>
          )}

          {combinedList.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.clearBtn]}
              onPress={clearAll}>
              <Trash2 size={14} color="#EF4444" />
              <Text style={[styles.actionBtnText, styles.clearBtnText]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabBar}>
        {(['all', 'notifications', 'calls'] as TabType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.tabLabelActive,
              ]}>
              {tab === 'all'
                ? `All (${notifications.length + callLogs.length})`
                : tab === 'notifications'
                ? `Notifications (${unreadCount > 0 ? unreadCount : notifications.length})`
                : `Calls (${callLogs.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#6366F1"
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={combinedList}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            combinedList.length === 0 ? styles.emptyList : styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6366F1']}
              tintColor="#6366F1"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6366F1', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
  clearBtn: { backgroundColor: '#FEF2F2' },
  clearBtnText: { color: '#EF4444' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#6366F1' },
  tabLabel: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  tabLabelActive: { color: '#6366F1', fontWeight: '700' },

  list: { padding: 12 },
  emptyList: { flexGrow: 1 },
  loader: { flex: 1, alignSelf: 'center' },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});