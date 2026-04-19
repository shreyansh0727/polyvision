// src/hooks/useVoiceCall.ts
import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid }  from 'react-native';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RemoteAudioState,
} from 'react-native-agora';
import { apiPost } from '../services/api';

export type CallStatus = 'idle' | 'calling' | 'connected' | 'ended' | 'error';

export interface UseVoiceCallReturn {
  status:        CallStatus;
  isMuted:       boolean;
  isSpeaker:     boolean;
  duration:      number;
  startCall:     (employeeId: string, employeeName: string) => Promise<void>;
  endCall:       () => Promise<void>;
  toggleMute:    () => void;
  toggleSpeaker: () => void;
  error:         string | null;
}

async function getMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title:          'Microphone Permission',
      message:        'This app needs microphone access to make voice calls.',
      buttonPositive: 'Allow',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useVoiceCall(): UseVoiceCallReturn {
  const engine        = useRef<IRtcEngine | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const employeeIdRef = useRef<string>('');
  // Prevents markConnected from double-firing when both
  // onUserJoined AND onRemoteAudioStateChanged trigger for the same join
  const connectedRef  = useRef(false);

  const [status,    setStatus]    = useState<CallStatus>('idle');
  const [isMuted,   setIsMuted]   = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration,  setDuration]  = useState(0);
  const [error,     setError]     = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    connectedRef.current = false;
    engine.current?.leaveChannel();
    engine.current?.release();
    engine.current = null;
    setDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);
  }, []);

  // ── Single source of truth for connected state ────────────────
  // Called from both onUserJoined and onRemoteAudioStateChanged.
  // The connectedRef guard ensures the timer only starts once.
  const markConnected = useCallback(() => {
    if (connectedRef.current) return;
    connectedRef.current = true;
    setStatus('connected');
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
  }, []);

  const startCall = useCallback(async (employeeId: string, employeeName: string) => {
    setError(null);
    setStatus('calling');
    connectedRef.current  = false;
    employeeIdRef.current = employeeId;

    try {
      const granted = await getMicPermission();
      if (!granted) throw new Error('Microphone permission denied');

      const { channel, token, app_id, uid } = await apiPost<{
        channel: string; token: string; app_id: string; uid: number;
      }>('/admin/calls/token', { employee_id: employeeId });

      const rtcEngine = createAgoraRtcEngine();
      engine.current  = rtcEngine;

      rtcEngine.initialize({ appId: app_id });
      rtcEngine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      rtcEngine.enableAudio();
      rtcEngine.setDefaultAudioRouteToSpeakerphone(false);

      rtcEngine.registerEventHandler({

        // ── Admin joined their own channel ────────────────────────
        onJoinChannelSuccess: (_conn, _elapsed) => {
          console.log('[Agora] ✅ Admin joined channel, waiting for employee…');
        },

        // ── Primary: employee joined ──────────────────────────────
        // No uid check — in a 1:1 call ANY remote user joining
        // is the employee. Strict `=== 2` was causing the "stuck
        // on ringing" bug when Agora returned the uid as a different
        // numeric representation or the employee joined first.
        onUserJoined: (_conn, remoteUid, _elapsed) => {
          console.log('[Agora] 👤 Remote user joined uid=', remoteUid);
          markConnected();
        },

        // ── Fallback: remote audio started streaming ──────────────
        // Fires slightly after onUserJoined. Acts as a safety net
        // if the employee joined before the admin (FCM is very fast
        // — employee can accept before admin's joinChannel resolves)
        // causing onUserJoined to be missed entirely.
        onRemoteAudioStateChanged: (_conn, remoteUid, state, _reason, _elapsed) => {
          console.log('[Agora] 🔊 Remote audio state uid=', remoteUid, 'state=', state);
          if (state === RemoteAudioState.RemoteAudioStateDecoding) {
            markConnected();
          }
        },

        // ── Remote user left or dropped ───────────────────────────
        onUserOffline: (_conn, remoteUid, _reason) => {
          console.log('[Agora] 👋 Remote user offline uid=', remoteUid);
          setStatus('ended');
          cleanup();
        },

        // ── SDK-level errors ──────────────────────────────────────
        onError: (errCode, _msg) => {
          console.error('[Agora] ❌ Error code:', errCode);
          setError(`Connection error (${errCode})`);
          setStatus('error');
          cleanup();
        },
      });

      // uid = 1 for admin (returned by backend)
      rtcEngine.joinChannel(token, channel, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

    } catch (e: any) {
      const raw = e?.message ?? 'Failed to start call';
      const msg =
        raw.includes('token has expired') || raw.includes('no registered device')
          ? `${employeeName} is not reachable.\nAsk them to open the app and try again.`
          : raw;
      setError(msg);
      setStatus('error');
      cleanup();
    }
  }, [cleanup, markConnected]);

  const endCall = useCallback(async () => {
    try {
      await apiPost('/admin/calls/end', { employee_id: employeeIdRef.current });
    } catch (_) {}
    cleanup();
    setStatus('ended');
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      engine.current?.muteLocalAudioStream(!m);
      return !m;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => {
      engine.current?.setEnableSpeakerphone(!s);
      return !s;
    });
  }, []);

  return {
    status, isMuted, isSpeaker, duration,
    startCall, endCall, toggleMute, toggleSpeaker, error,
  };
}