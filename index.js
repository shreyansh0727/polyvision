// index.js
import { AppRegistry }     from 'react-native';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import messaging           from '@react-native-firebase/messaging';
import notifee, {
  EventType,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  AndroidLaunchActivityFlag,
}                          from '@notifee/react-native';
import { name as appName } from './app.json';
import App                 from './App';

const CHANNEL_ID        = 'incoming_call';
const VIBRATION_PATTERN = [100, 500, 250, 500];

// ── Shared helper ─────────────────────────────────────────────────
async function displayCallNotification(data) {
  await notifee.createChannel({
    id:               CHANNEL_ID,
    name:             'Incoming Calls',
    importance:       AndroidImportance.HIGH,
    vibration:        true,
    vibrationPattern: VIBRATION_PATTERN,
    sound:            'default',
    visibility:       AndroidVisibility.PUBLIC,
  });

  await notifee.displayNotification({
    id:    CHANNEL_ID,
    title: '📞 Incoming Call',
    body:  `${data.caller_name ?? 'Admin'} is calling you`,
    data,
    android: {
      channelId:   CHANNEL_ID,
      category:    AndroidCategory.CALL,
      importance:  AndroidImportance.HIGH,
      visibility:  AndroidVisibility.PUBLIC,
      fullScreenAction: {
        id:                  'default',
        launchActivity:      'default',
        launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
      },
      pressAction: {
        id:             'default',
        launchActivity: 'default',
      },
      actions: [
        {
          title:       '✅ Accept',
          pressAction: {
            id:             'accept',
            launchActivity: 'default',
          },
        },
        {
          title:       '❌ Decline',
          pressAction: { id: 'decline' },
        },
      ],
      vibrationPattern: VIBRATION_PATTERN,
      sound:            'default',
    },
  });
}

// ── FCM background + killed state ────────────────────────────────
messaging().setBackgroundMessageHandler(async (message) => {
  const data = message.data ?? {};

  if (data.type === 'call_invite') {
    if (!data.channel || !data.token || !data.app_id) {
      console.warn('[FCM:bg] call_invite missing fields:', data);
      return;
    }
    await displayCallNotification(data);
  }

  if (data.type === 'call_ended') {
    await notifee.cancelNotification(CHANNEL_ID);
  }
});

// ── Notifee background + killed state action buttons ─────────────
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data     = detail.notification?.data;
  const actionId = detail.pressAction?.id;

  const isAccept =
    (type === EventType.ACTION_PRESS && actionId === 'accept') ||
    type === EventType.PRESS;

  if (isAccept && data) {
    await notifee.cancelNotification(CHANNEL_ID);
    // Await explicitly so write completes before the process dies
    await AsyncStorage.setItem('@pending_call_data', JSON.stringify(data));
    console.log('[Notifee:bg] pendingCall persisted:', data.caller_name);
  }

  if (type === EventType.ACTION_PRESS && actionId === 'decline') {
    await notifee.cancelNotification(CHANNEL_ID);
    console.log('[Notifee:bg] Call declined');
  }
});

// ── Headless task (required for killed-state Notifee events) ──────
AppRegistry.registerHeadlessTask(
  'ReactNativeFirebaseMessagingHeadlessTask',
  () => async (message) => {
    const data = message?.data ?? {};
    if (data.type === 'call_invite') {
      await displayCallNotification(data);
    }
    if (data.type === 'call_ended') {
      await notifee.cancelNotification(CHANNEL_ID);
    }
  },
);

AppRegistry.registerComponent(appName, () => App);