// src/utils/inboxHelpers.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import {
  NotificationRecord,
  CallLogRecord,
} from '../screens/employee/EmployeeNotificationsScreen';

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
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    console.warn(`[inboxHelpers] Failed to write key "${key}"`, error);
    throw error;
  }
}

function trimList<T>(items: T[]): T[] {
  return items.slice(0, MAX_ITEMS);
}

export async function saveNotification(
  title: string,
  body: string,
  sentBy: string,
): Promise<NotificationRecord> {
  const existing = await readList<NotificationRecord>(NOTIF_KEY);

  const normalizedTitle = title?.trim() || 'Notification';
  const normalizedBody = body?.trim() || '';
  const normalizedSentBy = sentBy?.trim() || 'Admin';

  const duplicate = existing.find(
    item =>
      item.title === normalizedTitle &&
      item.body === normalizedBody &&
      item.sentBy === normalizedSentBy &&
      Math.abs(
        new Date(item.sentAt).getTime() - Date.now(),
      ) < 5000,
  );

  if (duplicate) {
    return duplicate;
  }

  const record: NotificationRecord = {
    id: String(uuid.v4()),
    type: 'notification',
    title: normalizedTitle,
    body: normalizedBody,
    sentBy: normalizedSentBy,
    sentAt: new Date().toISOString(),
    read: false,
  };

  await writeList(NOTIF_KEY, trimList([record, ...existing]));
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
    callerName: callerName?.trim() || 'Unknown',
    callerPhone: callerPhone?.trim() || '',
    status,
    duration,
    timestamp: new Date().toISOString(),
  };

  await writeList(CALL_KEY, trimList([record, ...existing]));
  return record;
}

export async function upsertCallLog(
  match: Partial<Pick<CallLogRecord, 'callerName' | 'callerPhone'>>,
  updates: Partial<Omit<CallLogRecord, 'id' | 'type'>>,
): Promise<CallLogRecord> {
  const existing = await readList<CallLogRecord>(CALL_KEY);

  const index = existing.findIndex(
    item =>
      (match.callerPhone && item.callerPhone === match.callerPhone) ||
      (match.callerName && item.callerName === match.callerName),
  );

  if (index === -1) {
    return saveCallLog(
      updates.callerName ?? match.callerName ?? 'Unknown',
      updates.callerPhone ?? match.callerPhone ?? '',
      updates.status ?? 'missed',
      updates.duration ?? 0,
    );
  }

  const updatedRecord: CallLogRecord = {
    ...existing[index],
    ...updates,
  };

  const updatedList = [...existing];
  updatedList[index] = updatedRecord;

  updatedList.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  await writeList(CALL_KEY, trimList(updatedList));
  return updatedRecord;
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
  const notifications = await readList<NotificationRecord>(NOTIF_KEY);
  const updated = notifications.map(item =>
    item.id === id ? { ...item, read: true } : item,
  );
  await writeList(NOTIF_KEY, updated);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const notifications = await readList<NotificationRecord>(NOTIF_KEY);
  const updated = notifications.map(item => ({ ...item, read: true }));
  await writeList(NOTIF_KEY, updated);
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