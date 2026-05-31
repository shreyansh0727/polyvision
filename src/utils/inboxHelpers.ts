// src/utils/inboxHelpers.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import {
  NotificationRecord,
  CallLogRecord,
} from '../screens/employee/EmployeeNotificationsScreen';

const NOTIF_KEY = 'employee_notifications';
const CALL_KEY = 'employee_call_logs';

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveNotification(
  title: string,
  body: string,
  sentBy: string,
): Promise<NotificationRecord> {
  const existing = await readList<NotificationRecord>(NOTIF_KEY);

  const record: NotificationRecord = {
    id: String(uuid.v4()),
    type: 'notification',
    title,
    body,
    sentBy,
    sentAt: new Date().toISOString(),
    read: false,
  };

  await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify([record, ...existing]));
  return record;
}

export async function saveCallLog(
  callerName: string,
  callerPhone: string,
  status: CallLogRecord['status'],
  duration = 0,
): Promise<CallLogRecord> {
  const existing = await readList<CallLogRecord>(CALL_KEY);

  const record: CallLogRecord = {
    id: String(uuid.v4()),
    type: 'call',
    callerName,
    callerPhone,
    status,
    duration,
    timestamp: new Date().toISOString(),
  };

  await AsyncStorage.setItem(CALL_KEY, JSON.stringify([record, ...existing]));
  return record;
}

export async function getNotifications(): Promise<NotificationRecord[]> {
  return readList<NotificationRecord>(NOTIF_KEY);
}

export async function getCallLogs(): Promise<CallLogRecord[]> {
  return readList<CallLogRecord>(CALL_KEY);
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const notifications = await readList<NotificationRecord>(NOTIF_KEY);
  const updated = notifications.map(item =>
    item.id === id ? { ...item, read: true } : item,
  );
  await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
}

export async function clearNotifications(): Promise<void> {
  await AsyncStorage.removeItem(NOTIF_KEY);
}

export async function clearCallLogs(): Promise<void> {
  await AsyncStorage.removeItem(CALL_KEY);
}