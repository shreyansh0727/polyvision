// src/screens/auth/LoginScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert,
  KeyboardAvoidingView, ScrollView, Platform,
  TextInput as TextInputType, Animated, Easing,
  Dimensions, StatusBar, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Eye, EyeOff, Mail, Lock, ArrowRight, Shield, WifiOff,
} from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useAuthStore } from '../../store/authStore';
import { useOfflineStore } from '../../store/offlineStore';
import { MC, MF } from '../../navigation/AppTheme';

const { width: SCREEN_W } = Dimensions.get('window');

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

type FormErrors = { email?: string; password?: string };

// ─────────────────────────────────────────────────────────────────
// Staggered entry hook
// ─────────────────────────────────────────────────────────────────
function useStaggerIn(count: number, delay = 80) {
  const anims = useRef(
    Array.from({ length: count }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(24),
    })),
  ).current;

  useEffect(() => {
    Animated.parallel(
      anims.map(({ opacity, translateY }, i) =>
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            delay: 120 + i * delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 480,
            delay: 120 + i * delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start();
  }, []);

  return anims;
}

// ─────────────────────────────────────────────────────────────────
// Inline input
// ─────────────────────────────────────────────────────────────────
const InlineInput = React.forwardRef<TextInputType, {
  label:           string;
  value:           string;
  onChangeText:    (v: string) => void;
  placeholder:     string;
  error?:          string;
  Icon:            typeof Mail;
  secureEntry?:    boolean;
  keyboardType?:   any;
  autoCapitalize?: any;
  returnKeyType?:  any;
  editable?:       boolean;
  onSubmitEditing?: () => void;
}>(function InlineInput(
  {
    label, value, onChangeText, placeholder, error, Icon,
    secureEntry = false, keyboardType = 'default',
    autoCapitalize = 'none', returnKeyType = 'done',
    editable = true, onSubmitEditing,
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? MC.rose : MC.border, error ? MC.rose : MC.green],
  });

  return (
    <View style={inputStyles.wrap}>
      <Text style={inputStyles.label}>{label}</Text>
      <Animated.View style={[inputStyles.box, { borderColor }]}>
        <View style={inputStyles.iconLeft}>
          <Icon
            size={15}
            color={focused ? MC.green : MC.textFaint}
            strokeWidth={focused ? 2.2 : 1.5}
          />
        </View>

        <TextInputType
          ref={ref as any}
          style={inputStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MC.textFaint}
          secureTextEntry={secureEntry && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          editable={editable}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing}
        />

        {secureEntry && (
          <TouchableOpacity
            style={inputStyles.iconRight}
            onPress={() => setRevealed(r => !r)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            {revealed ? (
              <EyeOff size={15} color={MC.textSub} strokeWidth={1.5} />
            ) : (
              <Eye size={15} color={MC.textSub} strokeWidth={1.5} />
            )}
          </TouchableOpacity>
        )}
      </Animated.View>

      {focused && (
        <View
          style={[
            inputStyles.focusBar,
            { backgroundColor: error ? MC.rose : MC.green },
          ]}
        />
      )}
      {error ? <Text style={inputStyles.error}>{error}</Text> : null}
    </View>
  );
});

const inputStyles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MC.surfaceAlt,
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  iconLeft: { paddingLeft: 14, paddingRight: 4 },
  iconRight: { paddingRight: 14, paddingLeft: 4 },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 14,
    color: MC.textPrimary,
    fontFamily: MF.mono,
  },
  focusBar: {
    height: 2,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -2,
  },
  error: {
    fontSize: 10,
    color: MC.rose,
    fontFamily: MF.mono,
    marginTop: 5,
    letterSpacing: 0.3,
  },
});

// ─────────────────────────────────────────────────────────────────
// CTA Button
// ─────────────────────────────────────────────────────────────────
function SignInButton({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (disabled || loading) return;
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={loading || disabled}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          btnStyles.btn,
          {
            transform: [{ scale: scaleAnim }],
            opacity: loading || disabled ? 0.6 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={MC.bg} size="small" />
        ) : (
          <>
            <Text style={btnStyles.label}>
              {disabled ? 'OFFLINE' : 'SIGN IN'}
            </Text>
            {!disabled && (
              <ArrowRight size={16} color={MC.bg} strokeWidth={2.5} />
            )}
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: MC.green,
    borderRadius: 14,
    paddingVertical: 17,
    shadowColor: MC.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
    letterSpacing: 2.5,
  },
});

// ─────────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const passwordRef = useRef<TextInputType>(null);
  const login = useAuthStore(s => s.login);
  const loading = useAuthStore(s => s.loading);

  // Offline state
  const isOnline = useOfflineStore(s => s.isOnline);

  const shakeX = useRef(new Animated.Value(0)).current;
  const s = useStaggerIn(7, 80); // one more stagger slot for offline banner

  function shake() {
    ReactNativeHapticFeedback.trigger('notificationError', HAPTIC_OPTIONS);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Password is required';
    else if (password.length < 6) next.password = 'Minimum 6 characters';
    setErrors(next);
    if (Object.keys(next).length > 0) shake();
    return Object.keys(next).length === 0;
  }

  const handleLogin = async () => {
    if (!isOnline) {
      shake();
      Alert.alert(
        'Offline',
        'You are offline. Connect to the internet to sign in.',
        [{ text: 'OK' }],
      );
      return;
    }

    if (!validate()) return;
    ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS);
    try {
      await login(email.trim().toLowerCase(), password);
      ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS);
    } catch (e: any) {
      shake();
      const msg =
        e?.message?.toLowerCase().includes('network') ||
        e?.message?.toLowerCase().includes('connection')
          ? 'Network error. Please check your internet connection and try again.'
          : e?.message ?? 'Check your credentials and try again.';
      Alert.alert('Authentication Failed', msg, [{ text: 'OK' }]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* Grid overlay */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.gridCol, { left: `${i * 14.28}%` as any }]} />
        ))}
      </View>

      {/* Ambient blobs */}
      <View style={[styles.blob, styles.blobTL]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobBR]} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Offline banner (only on login) */}
        {!isOnline && (
          <Animated.View
            style={[
              styles.offlineBanner,
              {
                opacity: s[0].opacity,
                transform: [{ translateY: s[0].translateY }],
              },
            ]}
          >
            <WifiOff size={12} color={MC.rose} />
            <Text style={styles.offlineBannerText}>
              You are offline. Sign‑in is temporarily disabled.
            </Text>
          </Animated.View>
        )}

        {/* Badge */}
        <Animated.View
          style={[
            styles.badgeRow,
            { opacity: s[1].opacity, transform: [{ translateY: s[1].translateY }] },
          ]}
        >
          <View style={styles.badge}>
            <Shield size={10} color={MC.green} strokeWidth={2} />
            <Text style={styles.badgeText}>POLYVISION · FIELD OPS</Text>
          </View>
          <View style={styles.statusDot} />
        </Animated.View>

        {/* Eyebrow */}
        <Animated.Text
          style={[
            styles.eyebrow,
            { opacity: s[2].opacity, transform: [{ translateY: s[2].translateY }] },
          ]}
        >
          SECURE ACCESS
        </Animated.Text>

        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            { opacity: s[3].opacity, transform: [{ translateY: s[3].translateY }] },
          ]}
        >
          Sign in to{'\n'}your account.
        </Animated.Text>

        {/* Form card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: s[4].opacity,
              transform: [{ translateY: s[4].translateY }, { translateX: shakeX }],
            },
          ]}
        >
          <InlineInput
            label="Email Address"
            value={email}
            onChangeText={v => {
              setEmail(v);
              if (errors.email) setErrors(e => ({ ...e, email: undefined }));
            }}
            placeholder="you@company.com"
            error={errors.email}
            Icon={Mail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            editable={!loading}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <InlineInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={v => {
              setPassword(v);
              if (errors.password) setErrors(e => ({ ...e, password: undefined }));
            }}
            placeholder="••••••••"
            error={errors.password}
            Icon={Lock}
            secureEntry
            returnKeyType="done"
            editable={!loading}
            onSubmitEditing={handleLogin}
          />

          <Text style={styles.forgot}>
            Forgot password? Contact your administrator.
          </Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View
          style={[
            styles.ctaWrap,
            { opacity: s[5].opacity, transform: [{ translateY: s[5].translateY }] },
          ]}
        >
          <SignInButton onPress={handleLogin} loading={loading} disabled={!isOnline} />
        </Animated.View>

        {/* Footer */}
        <Animated.View style={[styles.footerRow, { opacity: s[6].opacity }]}>
          <View style={styles.footerDot} />
          <Text style={styles.footer}>END-TO-END ENCRYPTED</Text>
          <View style={styles.footerDot} />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MC.bg },
  gridOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.025 },
  gridCol: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: MC.green },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.07 },
  blobTL: { width: 300, height: 300, top: -100, left: -100, backgroundColor: MC.green },
  blobBR: { width: 240, height: 240, bottom: 0, right: -80, backgroundColor: MC.blue },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 52,
  },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${MC.rose}18`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${MC.rose}44`,
    marginBottom: 16,
  },
  offlineBannerText: {
    fontSize: 11,
    color: MC.rose,
    fontFamily: MF.mono,
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${MC.green}12`,
    borderWidth: 1,
    borderColor: `${MC.green}30`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: MC.green,
    fontFamily: MF.mono,
    letterSpacing: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MC.green,
    shadowColor: MC.green,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
    lineHeight: 44,
    letterSpacing: -0.8,
    marginBottom: 28,
  },
  card: {
    backgroundColor: MC.surface,
    borderRadius: 20,
    padding: 22,
    paddingTop: 26,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: MC.borderBright,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
  forgot: {
    fontSize: 10,
    color: MC.textFaint,
    fontFamily: MF.mono,
    textAlign: 'right',
    letterSpacing: 0.3,
    marginTop: -6,
  },
  ctaWrap: { marginBottom: 28 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: MC.textFaint },
  footer: {
    fontSize: 9,
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 2.5,
  },
});