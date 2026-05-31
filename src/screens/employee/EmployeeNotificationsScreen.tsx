// src/screens/employee/EmployeeNotificationsScreen.tsx
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
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, Phone, Inbox, CheckCheck, Trash2 } from 'lucide-react-native';

import { NotificationItem } from '../../components/employee/NotificationItem';
import { CallLogItem } from '../../components/employee/CallLogItem';
import type { NotificationRecord, CallLogRecord } from '../../types/inbox';
import {
  getNotifications,
  getCallLogs,
  markAllNotificationsAsRead,
  clearNotifications,
  clearCallLogs,
  clearInbox,
  markNotificationAsRead,
} from '../../utils/inboxHelpers';
import { MC } from '../../navigation/AppTheme';

// ─── Responsive helpers ───────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const isTablet = SCREEN_W >= 768;
const hp = (px: number) => px; // pixel values already device-independent

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = 'all' | 'notifications' | 'calls';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EmployeeNotificationsScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab,      setActiveTab]      = useState<TabType>('all');
  const [notifications,  setNotifications]  = useState<NotificationRecord[]>([]);
  const [callLogs,       setCallLogs]       = useState<CallLogRecord[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [notifs, calls] = await Promise.all([
        getNotifications(),
        getCallLogs(),
      ]);
      setNotifications(notifs);
      setCallLogs(calls);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.warn('[EmployeeNotifications] Failed to mark all read:', e);
    }
  }, []);

  const handleClearAll = useCallback(() => {
    const message =
      activeTab === 'all'
        ? 'Remove all notifications and call logs?'
        : activeTab === 'notifications'
        ? 'Remove all notifications?'
        : 'Remove all call logs?';

    Alert.alert('Clear inbox', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            if (activeTab === 'all') {
              await clearInbox();
              setNotifications([]);
              setCallLogs([]);
            } else if (activeTab === 'notifications') {
              await clearNotifications();
              setNotifications([]);
            } else {
              await clearCallLogs();
              setCallLogs([]);
            }
          } catch (e) {
            console.warn('[EmployeeNotifications] Failed to clear data:', e);
          }
        },
      },
    ]);
  }, [activeTab]);

  const handleRead = useCallback(async (id: string) => {
    try {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n)),
      );
      await markNotificationAsRead(id);
    } catch (e) {
      console.warn('[EmployeeNotifications] Failed to mark read:', e);
    }
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  const combinedList = useMemo<(NotificationRecord | CallLogRecord)[]>(() => {
    if (activeTab === 'notifications') return notifications;
    if (activeTab === 'calls')         return callLogs;
    return [...notifications, ...callLogs].sort((a, b) => {
      const da = a.type === 'notification' ? a.sentAt    : a.timestamp;
      const db = b.type === 'notification' ? b.sentAt    : b.timestamp;
      return new Date(db).getTime() - new Date(da).getTime();
    });
  }, [activeTab, notifications, callLogs]);

  const tabCount = useCallback(
    (tab: TabType): number => {
      if (tab === 'notifications') return notifications.length;
      if (tab === 'calls')         return callLogs.length;
      return notifications.length + callLogs.length;
    },
    [notifications.length, callLogs.length],
  );

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: NotificationRecord | CallLogRecord }) =>
      item.type === 'notification' ? (
        <NotificationItem item={item} onRead={handleRead} />
      ) : (
        <CallLogItem item={item} />
      ),
    [handleRead],
  );

  const keyExtractor = useCallback(
    (item: NotificationRecord | CallLogRecord) => item.id,
    [],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconRing}>
          <View style={styles.emptyIconInner}>
            {activeTab === 'calls' ? (
              <Phone size={28} color={MC.green} strokeWidth={1.8} />
            ) : activeTab === 'notifications' ? (
              <Bell size={28} color={MC.green} strokeWidth={1.8} />
            ) : (
              <Inbox size={28} color={MC.green} strokeWidth={1.8} />
            )}
          </View>
        </View>
        <Text style={styles.emptyTitle}>All clear</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'calls'
            ? 'Call logs from admin will appear here.'
            : activeTab === 'notifications'
            ? 'Notifications from admin will appear here.'
            : 'Notifications and call logs will appear here.'}
        </Text>
      </View>
    ),
    [activeTab],
  );

  // ── Tab bar ───────────────────────────────────────────────────────────────────
  const TAB_DEFS: { id: TabType; icon: React.ReactNode; label: string }[] = [
    {
      id: 'all',
      icon: <Inbox size={14} color={activeTab === 'all' ? MC.green : MC.textSub} strokeWidth={2} />,
      label: 'All',
    },
    {
      id: 'notifications',
      icon: <Bell size={14} color={activeTab === 'notifications' ? MC.green : MC.textSub} strokeWidth={2} />,
      label: 'Alerts',
    },
    {
      id: 'calls',
      icon: <Phone size={14} color={activeTab === 'calls' ? MC.green : MC.textSub} strokeWidth={2} />,
      label: 'Calls',
    },
  ];

  const showMarkRead  = unreadCount > 0 && activeTab !== 'calls';
  const showClearBtn  = combinedList.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenLabel}>INBOX</Text>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>
                {unreadCount > 99 ? '99+' : unreadCount} unread
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {showMarkRead && (
            <TouchableOpacity
              style={styles.actionChip}
              onPress={markAllRead}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
            >
              <CheckCheck size={13} color={MC.green} strokeWidth={2.2} />
              <Text style={styles.actionChipText}>Mark read</Text>
            </TouchableOpacity>
          )}
          {showClearBtn && (
            <TouchableOpacity
              style={[styles.actionChip, styles.actionChipDestructive]}
              onPress={handleClearAll}
              accessibilityRole="button"
              accessibilityLabel="Clear inbox"
            >
              <Trash2 size={13} color={MC.rose} strokeWidth={2.2} />
              <Text style={[styles.actionChipText, { color: MC.rose }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {TAB_DEFS.map(tab => {
          const isActive = activeTab === tab.id;
          const count    = tabCount(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab, ${count} items`}
            >
              {tab.icon}
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
              {/* Unread indicator dot on Alerts tab */}
              {tab.id === 'notifications' && unreadCount > 0 && (
                <View style={styles.tabDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={MC.green} />
          <Text style={styles.loaderText}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={combinedList}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
            combinedList.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MC.green]}
              tintColor={MC.green}
              progressBackgroundColor={MC.surfaceAlt}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS    = 14;
const HEADER_RADIUS  = 0;
const CHIP_RADIUS    = 8;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MC.bg,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection:      'row',
    justifyContent:     'space-between',
    alignItems:         'flex-start',
    paddingHorizontal:  isTablet ? 28 : 18,
    paddingTop:         20,
    paddingBottom:      16,
    backgroundColor:    MC.surface,
    borderBottomWidth:  1,
    borderBottomColor:  MC.border,
    borderRadius:       HEADER_RADIUS,
  },
  headerLeft: {
    flex: 1,
    gap:  4,
  },
  screenLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 2.5,
    color:         MC.green,
  },
  headerTitle: {
    fontSize:   isTablet ? 26 : 22,
    fontWeight: '700',
    color:      MC.textPrimary,
    lineHeight: isTablet ? 32 : 28,
  },
  unreadPill: {
    alignSelf:        'flex-start',
    marginTop:        4,
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      999,
    backgroundColor:  MC.greenDim,
    borderWidth:      1,
    borderColor:      `${MC.green}40`,
  },
  unreadPillText: {
    fontSize:   11,
    fontWeight: '700',
    color:      MC.green,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingTop:    2,
  },
  actionChip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:     CHIP_RADIUS,
    backgroundColor:  MC.greenDim,
    borderWidth:      1,
    borderColor:      `${MC.green}30`,
  },
  actionChipDestructive: {
    backgroundColor: MC.roseDim,
    borderColor:     `${MC.rose}30`,
  },
  actionChipText: {
    fontSize:   12,
    fontWeight: '600',
    color:      MC.green,
  },

  // ── Tab bar ──────────────────────────────────────────────────────
  tabRow: {
    flexDirection:     'row',
    backgroundColor:   MC.surface,
    paddingHorizontal: isTablet ? 28 : 18,
    paddingBottom:     0,
    borderBottomWidth: 1,
    borderBottomColor: MC.border,
    gap:               4,
  },
  tabItem: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    position:        'relative',
  },
  tabItemActive: {
    borderBottomColor: MC.green,
  },
  tabText: {
    fontSize:   12,
    fontWeight: '600',
    color:      MC.textSub,
  },
  tabTextActive: {
    color:      MC.green,
    fontWeight: '700',
  },
  tabCount: {
    backgroundColor:  MC.surfaceLift,
    borderRadius:     999,
    minWidth:         20,
    height:           18,
    paddingHorizontal: 5,
    alignItems:       'center',
    justifyContent:   'center',
  },
  tabCountActive: {
    backgroundColor: MC.greenDim,
  },
  tabCountText: {
    fontSize:   10,
    fontWeight: '700',
    color:      MC.textSub,
  },
  tabCountTextActive: {
    color: MC.green,
  },
  tabDot: {
    position:        'absolute',
    top:             10,
    right:           isTablet ? 18 : 8,
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: MC.rose,
    borderWidth:     1.5,
    borderColor:     MC.surface,
  },

  // ── List ─────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: isTablet ? 28 : 14,
    paddingTop:        14,
    gap:               1,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // ── Loading ──────────────────────────────────────────────────────
  loaderWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  loaderText: {
    fontSize:   13,
    color:      MC.textSub,
    fontWeight: '500',
  },

  // ── Empty ────────────────────────────────────────────────────────
  emptyContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap:            12,
  },
  emptyIconRing: {
    width:           80,
    height:          80,
    borderRadius:    40,
    borderWidth:     1,
    borderColor:     `${MC.green}30`,
    backgroundColor: MC.greenDim,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  emptyIconInner: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: `${MC.green}14`,
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyTitle: {
    fontSize:   17,
    fontWeight: '700',
    color:      MC.textPrimary,
  },
  emptySubtitle: {
    fontSize:      13,
    color:         MC.textSub,
    textAlign:     'center',
    lineHeight:    20,
    paddingHorizontal: 16,
  },
});