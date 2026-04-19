// src/screens/employee/ProfileScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useAuthStore }        from '../../store/authStore';
import { MC, MF, avatarColor } from '../../navigation/AppTheme';
import {
  KeyRound, LogOut, Eye, EyeOff, X,
  User, Mail, Shield, ChevronDown, ChevronUp,
  Lock, CheckCircle2,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────
// AvatarRing — SVG decorative ring behind the avatar circle
// ─────────────────────────────────────────────────────────────────
function AvatarRing({ color }: { color: string }) {
  return (
    <Svg
      width={96}
      height={96}
      viewBox="0 0 96 96"
      style={{ position: 'absolute' }}
    >
      <Defs>
        <RadialGradient id="rg" cx="50%" cy="50%" r="50%">
          <Stop offset="60%"  stopColor={color} stopOpacity={0} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.35} />
        </RadialGradient>
      </Defs>
      {/* Outer glow ring */}
      <Circle cx={48} cy={48} r={46} fill="url(#rg)" />
      {/* Dashed orbit ring */}
      <Circle
        cx={48} cy={48} r={44}
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={1}
        strokeDasharray="4 6"
        fill="none"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// InfoRow
// ─────────────────────────────────────────────────────────────────
function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>{icon}</View>
      <View style={s.infoContent}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// PasswordField
// ─────────────────────────────────────────────────────────────────
function PasswordField({
  placeholder, value, onChangeText, show, onToggle,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={s.inputRow}>
      <Lock size={13} color={MC.textFaint} style={{ marginRight: 8 }} />
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={MC.textFaint}
        secureTextEntry={!show}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={onToggle} style={s.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        {show
          ? <EyeOff size={16} color={MC.textSub} />
          : <Eye    size={16} color={MC.textSub} />}
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// ProfileScreen
// ─────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const employee       = useAuthStore((s) => s.employee);
  const logout         = useAuthStore((s) => s.logout);
  const changePassword = useAuthStore((s) => s.changePassword);
  const loading        = useAuthStore((s) => s.loading);
  const clearError     = useAuthStore((s) => s.clearError);

  const [showForm,    setShowForm]    = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const name     = employee?.name  ?? '—';
  const email    = employee?.email ?? '—';
  const role     = employee?.role  ?? '—';
  const initial  = employee?.name?.charAt(0).toUpperCase() ?? '?';
  const accent   = employee?.name ? avatarColor(employee.name) : MC.green;
  const avatarBg = `${accent}1A`;

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPass) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    Alert.alert(
      'Change Password',
      'You will be logged out after changing your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', style: 'destructive',
          onPress: async () => {
            try {
              await changePassword(newPassword);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to change password');
            }
          },
        },
      ],
    );
  };

  const toggleForm = () => {
    clearError();
    setNewPassword('');
    setConfirmPass('');
    setShowForm((v) => !v);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Avatar ── */}
        <View style={s.avatarOuter}>
          <AvatarRing color={accent} />
          <View style={[s.avatar, { backgroundColor: avatarBg, borderColor: accent }]}>
            <Text style={[s.initial, { color: accent }]}>{initial}</Text>
          </View>
        </View>

        <Text style={s.name}>{name}</Text>

        {/* Role badge */}
        <View style={[s.roleBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
          <Shield size={10} color={accent} />
          <Text style={[s.roleText, { color: accent }]}>{role}</Text>
        </View>

        {/* ── Info card ── */}
        <View style={s.infoCard}>
          <InfoRow
            icon={<User  size={13} color={MC.blue} />}
            label="Full Name"
            value={name}
          />
          <View style={s.infoDiv} />
          <InfoRow
            icon={<Mail  size={13} color={MC.gold} />}
            label="Email"
            value={email}
          />
          <View style={s.infoDiv} />
          <InfoRow
            icon={<Shield size={13} color={accent} />}
            label="Role"
            value={role}
          />
        </View>

        {/* ── Change Password toggle ── */}
        <TouchableOpacity style={s.changeBtn} onPress={toggleForm} activeOpacity={0.75}>
          {showForm
            ? <X        size={14} color={MC.textSub} />
            : <KeyRound size={14} color={MC.textSub} />}
          <Text style={s.changeBtnText}>
            {showForm ? 'Cancel' : 'Change Password'}
          </Text>
          {showForm
            ? <ChevronUp   size={13} color={MC.textFaint} />
            : <ChevronDown size={13} color={MC.textFaint} />}
        </TouchableOpacity>

        {/* ── Change Password form ── */}
        {showForm && (
          <View style={s.form}>
            <PasswordField
              placeholder="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
            />
            <PasswordField
              placeholder="Confirm new password"
              value={confirmPass}
              onChangeText={setConfirmPass}
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />

            {/* Strength hint */}
            {newPassword.length > 0 && (
              <View style={s.strengthRow}>
                <View style={[
                  s.strengthBar,
                  {
                    backgroundColor:
                      newPassword.length < 6  ? MC.rose :
                      newPassword.length < 10 ? MC.gold : MC.green,
                    width: `${Math.min(newPassword.length * 8, 100)}%`,
                  },
                ]} />
                <Text style={s.strengthLabel}>
                  {newPassword.length < 6 ? 'Too short' : newPassword.length < 10 ? 'Fair' : 'Strong'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, loading && s.disabledBtn]}
              onPress={handleChangePassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={MC.bg} size="small" />
                : <>
                    <CheckCircle2 size={15} color={MC.bg} />
                    <Text style={s.submitText}>Update Password</Text>
                  </>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Logout ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={15} color={MC.bg} />
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex:      { flex: 1 },
  container: {
    flexGrow: 1, alignItems: 'center',
    gap: 12, padding: 24, paddingTop: 40,
    backgroundColor: MC.bg,
  },

  // ── Avatar ──────────────────────────────────────────────────────
  avatarOuter: {
    width: 96, height: 96,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  initial: { fontSize: 28, fontWeight: '800', fontFamily: MF.display },

  name: {
    fontSize: 22, fontWeight: '800', color: MC.textPrimary,
    fontFamily: MF.display, letterSpacing: 0.2,
  },

  // ── Role badge ───────────────────────────────────────────────────
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  roleText: {
    fontSize: 10, fontWeight: '700',
    fontFamily: MF.mono, textTransform: 'capitalize', letterSpacing: 0.4,
  },

  // ── Info card ────────────────────────────────────────────────────
  infoCard: {
    width: '100%', backgroundColor: MC.surface,
    borderRadius: 16, borderWidth: 1, borderColor: MC.border,
    paddingVertical: 4, marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: MC.surfaceAlt, borderWidth: 1, borderColor: MC.border,
    alignItems: 'center', justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 9,  color: MC.textFaint, fontFamily: MF.mono, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  infoValue:   { fontSize: 13, color: MC.textPrimary, fontFamily: MF.mono, fontWeight: '600' },
  infoDiv:     { height: 1, backgroundColor: MC.border, marginHorizontal: 16 },

  // ── Change password ──────────────────────────────────────────────
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: MC.border, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 20,
    backgroundColor: MC.surface, width: '100%',
  },
  changeBtnText: {
    flex: 1, color: MC.textPrimary, fontSize: 13,
    fontWeight: '600', fontFamily: MF.mono,
  },
  form: { width: '100%', gap: 10 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: MC.border, borderRadius: 12,
    backgroundColor: MC.surfaceAlt, paddingHorizontal: 14,
  },
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: 14, color: MC.textPrimary, fontFamily: MF.mono,
  },
  eyeBtn: { padding: 4 },

  // Strength bar
  strengthRow: { gap: 6 },
  strengthBar: { height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 10, color: MC.textFaint, fontFamily: MF.mono },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: MC.green, borderRadius: 12,
    paddingVertical: 13,
    shadowColor: MC.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  disabledBtn: { opacity: 0.5 },
  submitText: {
    color: MC.bg, fontWeight: '800', fontSize: 14,
    fontFamily: MF.mono, letterSpacing: 0.3,
  },

  // ── Logout ───────────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4, backgroundColor: MC.rose,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32,
    borderWidth: 1, borderColor: `${MC.rose}66`,
    shadowColor: MC.rose, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 7,
    width: '100%',
  },
  logoutText: {
    color: MC.bg, fontWeight: '800', fontSize: 14,
    fontFamily: MF.mono, letterSpacing: 0.4,
  },
});