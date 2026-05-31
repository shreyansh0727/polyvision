// src/hooks/useNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  getMessaging,
  requestPermission,
  AuthorizationStatus,
  getToken,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification,
  registerDeviceForRemoteMessages,
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  AndroidLaunchActivityFlag,
  EventType,
} from '@notifee/react-native';
import { useAuthStore } from '../store/authStore';
import { apiPost } from '../services/api';
import { navigationRef } from '../navigation/navigationRef';
import { saveNotification, saveCallLog } from '../utils/inboxHelpers';

const CHANNEL_CALL = 'incoming_call';
const CHANNEL_GENERAL = 'general';
const VIBRATION_PATTERN: number[] = [100, 500, 250, 500];

async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: CHANNEL_CALL,
    name: 'Incoming Calls',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: VIBRATION_PATTERN,
    sound: 'default',
    badge: true,
    visibility: AndroidVisibility.PUBLIC,
  });

  await notifee.createChannel({
    id: CHANNEL_GENERAL,
    name: 'General Notifications',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

async function showCallNotification(
  callerName: string,
  data: Record<string, string>,
): Promise<void> {
  await notifee.displayNotification({
    id: CHANNEL_CALL,
    title: '📞 Incoming Call',
    body: `${callerName} is calling you`,
    data,
    android: {
      channelId: CHANNEL_CALL,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      fullScreenAction: {
        id: 'default',
        launchActivity: 'default',
        launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
      },
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '✅ Accept',
          pressAction: {
            id: 'accept',
            launchActivity: 'default',
          },
        },
        {
          title: '❌ Decline',
          pressAction: { id: 'decline' },
        },
      ],
      vibrationPattern: VIBRATION_PATTERN,
      sound: 'default',
    },
    ios: {
      categoryId: 'call',
      interruptionLevel: 'timeSensitive',
      sound: 'default',
    },
  });
}

async function cancelCallNotification(): Promise<void> {
  await notifee.cancelNotification(CHANNEL_CALL);
}

async function setupIOSCallCategory(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await notifee.setNotificationCategories([
    {
      id: 'call',
      actions: [
        { id: 'accept', title: 'Accept' },
        { id: 'decline', title: 'Decline', destructive: true },
      ],
    },
  ]);
}

function navigateToCall(data: Record<string, string>): void {
  if (!navigationRef.isReady()) {
    console.warn('[FCM] navigateToCall: navigator not ready, retrying in 500ms…');
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('IncomingCall', {
          channel: data.channel ?? '',
          token: data.token ?? '',
          appId: data.app_id ?? '',
          callerName: data.caller_name ?? 'Admin',
          callerId: data.caller_id ?? '',
        });
      }
    }, 500);
    return;
  }

  navigationRef.navigate('IncomingCall', {
    channel: data.channel ?? '',
    token: data.token ?? '',
    appId: data.app_id ?? '',
    callerName: data.caller_name ?? 'Admin',
    callerId: data.caller_id ?? '',
  });
}

function setupNotifeeListeners(): () => void {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    const actionId = detail.pressAction?.id;
    const data = detail.notification?.data as Record<string, string> | undefined;

    const isAccept =
      (type === EventType.ACTION_PRESS && actionId === 'accept') ||
      type === EventType.PRESS;

    if (isAccept && data) {
      await cancelCallNotification();
      await saveCallLog(
        data.caller_name ?? 'Admin',
        data.caller_phone ?? '',
        'answered',
        0,
      );
      navigateToCall(data);
    }

    if (type === EventType.ACTION_PRESS && actionId === 'decline' && data) {
      await cancelCallNotification();
      await saveCallLog(
        data.caller_name ?? 'Admin',
        data.caller_phone ?? '',
        'rejected',
        0,
      );
    }
  });
}

async function requestAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    {
      title: 'Allow Notifications',
      message: 'Stay updated with tasks and alerts from your admin.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  const granted = result === PermissionsAndroid.RESULTS.GRANTED;
  if (!granted) console.warn('[FCM] POST_NOTIFICATIONS denied');
  return granted;
}

async function requestFirebasePermission(): Promise<boolean> {
  const status = await requestPermission(getMessaging());
  const authorized =
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL;

  if (!authorized) console.warn('[FCM] Firebase permission not granted:', status);
  return authorized;
}

async function registerToken(employeeId: string): Promise<void> {
  try {
    const token = await getToken(getMessaging());
    if (!token) {
      console.warn('[FCM] getToken() returned empty — APNs may not be ready');
      return;
    }

    await apiPost('/employees/fcm-token', { employee_id: employeeId, token });
    console.log('[FCM] Token registered:', token.slice(0, 24) + '…');
  } catch (e) {
    console.warn('[FCM] Token registration failed:', e);
  }
}

async function routeMessage(
  message: FirebaseMessagingTypes.RemoteMessage,
  source: 'foreground' | 'background' = 'foreground',
): Promise<void> {
  const data = (message.data ?? {}) as Record<string, string>;

  switch (data.type) {
    case 'call_invite': {
      if (!data.channel || !data.token || !data.app_id) {
        console.warn('[FCM] call_invite missing required fields:', data);
        return;
      }

      const callerName = data.caller_name ?? 'Admin';
      const callerPhone = data.caller_phone ?? '';

      await saveCallLog(callerName, callerPhone, 'missed', 0);

      if (source === 'foreground') {
        navigateToCall(data);
      } else {
        await cancelCallNotification();
        navigateToCall(data);
      }
      break;
    }

    case 'call_ended': {
      await cancelCallNotification();

      const currentRoute = navigationRef.getCurrentRoute();
      const routeName = currentRoute?.name as string | undefined;

      if (
        navigationRef.isReady() &&
        navigationRef.canGoBack() &&
        (routeName === 'IncomingCall' || routeName === 'EmployeeActiveCall')
      ) {
        navigationRef.goBack();
      }
      break;
    }

    default: {
      const title = message.notification?.title ?? data.title ?? 'Notification';
      const body = message.notification?.body ?? data.body ?? '';
      const sentBy = data.sent_by ?? data.sender_name ?? 'Admin';

      await saveNotification(title, body, sentBy);

      await notifee.displayNotification({
        title,
        body,
        android: { channelId: CHANNEL_GENERAL },
        ios: {},
      });
      break;
    }
  }
}

export function useNotifications(): void {
  const employee = useAuthStore(s => s.employee);
  const bootstrappedId = useRef<string | null>(null);

  useEffect(() => {
    if (!employee?.id || bootstrappedId.current === employee.id) return;
    bootstrappedId.current = employee.id;

    let unsubForeground: (() => void) | undefined;
    let unsubTokenRefresh: (() => void) | undefined;
    let unsubNotifee: (() => void) | undefined;
    let unsubOpenedApp: (() => void) | undefined;

    (async () => {
      try {
        if (Platform.OS === 'ios') {
          await registerDeviceForRemoteMessages(getMessaging());
          await setupIOSCallCategory();
        }

        await ensureChannels();

        if (!(await requestAndroidPermission())) return;
        if (!(await requestFirebasePermission())) return;

        await registerToken(employee.id);

        unsubNotifee = setupNotifeeListeners();

        unsubForeground = onMessage(getMessaging(), async message => {
          await routeMessage(message, 'foreground');
        });

        unsubTokenRefresh = onTokenRefresh(getMessaging(), async token => {
          try {
            await apiPost('/employees/fcm-token', {
              employee_id: employee.id,
              token,
            });
          } catch (e) {
            console.warn('[FCM] Token refresh re-registration failed:', e);
          }
        });

        unsubOpenedApp = onNotificationOpenedApp(getMessaging(), async message => {
          await routeMessage(message, 'background');
        });

        const initial = await getInitialNotification(getMessaging());
        if (initial) {
          await routeMessage(initial, 'background');
        }
      } catch (e) {
        console.warn('[FCM] Bootstrap error:', e);
      }
    })();

    return () => {
      unsubForeground?.();
      unsubTokenRefresh?.();
      unsubNotifee?.();
      unsubOpenedApp?.();
    };
  }, [employee?.id]);
}