// src/utils/inboxHelpers.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import {
  NotificationRecord,
  CallLogRecord,
  CallLogStatus,
} from '../types/inbox';

const NOTIF_KEY = 'employee_notifications';
const CALL_KEY = 'employee_call_logs';
const MAX_ITEMS = 100;

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.warn(`[inboxHelpers] Failed to read key "${key}"`, error);
    return [];
  }
}

async function writeList<T>(key: string, items: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch (error) {
    console.warn(`[inboxHelpers] Failed to write key "${key}"`, error);
    throw error;
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
    title: title?.trim() || 'Notification',
    body: body?.trim() || '',
    sentBy: sentBy?.trim() || 'Admin',
    sentAt: new Date().toISOString(),
    read: false,
  };

  await writeList(NOTIF_KEY, [record, ...existing]);
  return record;
}

export async function saveCallLog(
  callerName: string,
  callerPhone: string,
  status: CallLogStatus,
  duration = 0,
): Promise<CallLogRecord> {
  const existing = await readList<CallLogRecord>(CALL_KEY);

  const record: CallLogRecord = {
    id: String(uuid.v4()),
    type: 'call',
    callerName: callerName?.trim() || 'Unknown',
    callerPhone: callerPhone?.trim() || '',
    status,
    duration,
    timestamp: new Date().toISOString(),
  };

  await writeList(CALL_KEY, [record, ...existing]);
  return record;
}

export async function upsertLatestCallLog(
  callerName: string,
  callerPhone: string,
  status: CallLogStatus,
  duration = 0,
): Promise<CallLogRecord> {
  const existing = await readList<CallLogRecord>(CALL_KEY);

  const index = existing.findIndex(
    item =>
      item.callerPhone === (callerPhone?.trim() || '') &&
      item.callerName === (callerName?.trim() || 'Unknown'),
  );

  if (index === -1) {
    return saveCallLog(callerName, callerPhone, status, duration);
  }

  const updated: CallLogRecord = {
    ...existing[index],
    status,
    duration,
    callerName: callerName?.trim() || existing[index].callerName,
    callerPhone: callerPhone?.trim() || existing[index].callerPhone,
  };

  const next = [...existing];
  next[index] = updated;
  await writeList(CALL_KEY, next);
  return updated;
}

export async function getNotifications(): Promise<NotificationRecord[]> {
  const items = await readList<NotificationRecord>(NOTIF_KEY);
  return items.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
}

export async function getCallLogs(): Promise<CallLogRecord[]> {
  const items = await readList<CallLogRecord>(CALL_KEY);
  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const items = await readList<NotificationRecord>(NOTIF_KEY);
  await writeList(
    NOTIF_KEY,
    items.map(item => (item.id === id ? { ...item, read: true } : item)),
  );
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const items = await readList<NotificationRecord>(NOTIF_KEY);
  await writeList(
    NOTIF_KEY,
    items.map(item => ({ ...item, read: true })),
  );
}

export async function clearNotifications(): Promise<void> {
  await writeList(NOTIF_KEY, []);
}

export async function clearCallLogs(): Promise<void> {
  await writeList(CALL_KEY, []);
}

export async function clearInbox(): Promise<void> {
  await Promise.all([writeList(NOTIF_KEY, []), writeList(CALL_KEY, [])]);
}