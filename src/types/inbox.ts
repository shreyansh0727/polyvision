// src/types/inbox.ts
export type NotificationRecord = {
  id: string;
  type: 'notification';
  title: string;
  body: string;
  sentBy: string;
  sentAt: string;
  read: boolean;
};

export type CallLogStatus = 'answered' | 'missed' | 'rejected';

export type CallLogRecord = {
  id: string;
  type: 'call';
  callerName: string;
  callerPhone: string;
  duration: number;
  status: CallLogStatus;
  timestamp: string;
};