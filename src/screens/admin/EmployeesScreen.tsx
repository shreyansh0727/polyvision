// src/screens/admin/EmployeesScreen.tsx
import React, {
  useState, useEffect, useCallback, useRef, memo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated, RefreshControl, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Phone, Search, Users, X, CloudOff, UserPlus, User, Pencil, Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminStackParamList } from '../../navigation/AdminTabs';
import { MC, MF, avatarColor } from '../../navigation/AppTheme';
import { apiGet, apiPost, apiDelete, apiPatch } from '../../services/api';
import { useOfflineStore } from '../../store/offlineStore';

type AdminNav = NativeStackNavigationProp<AdminStackParamList>;

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'admin';
  is_active: boolean;
  created_at: string;
  fcm_token?: string | null;
  tenant_id?: string | null;
  created_by?: string | null;
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: 'employee';
}

interface EditForm {
  name: string;
  role: 'employee' | 'admin';
  is_active: boolean;
}

type FormErrors = Partial<Record<keyof CreateForm, string>>;
type EditErrors = Partial<Record<keyof EditForm, string>>;

const EMPTY_FORM: CreateForm = {
  name: '',
  email: '',
  password: '',
  role: 'employee',
};

// ─────────────────────────────────────────────────────────────────
// PulseDot
// ─────────────────────────────────────────────────────────────────
const PulseDot = memo(function PulseDot({
  color = MC.green,
  size = 7,
}: {
  color?: string;
  size?: number;
}) {
  const ring = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    ).start();
  }, [ring, ringOpacity]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
          transform: [{ scale: ring }],
          opacity: ringOpacity,
        }}
      />
      <View
        style={{
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────
// SkeletonCard
// ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.85],
  });

  return (
    <Animated.View style={[skelStyles.card, { opacity }]}>
      <View style={skelStyles.avatar} />
      <View style={skelStyles.lines}>
        <View style={skelStyles.lineWide} />
        <View style={skelStyles.lineNarrow} />
      </View>
      <View style={skelStyles.badge} />
      <View style={skelStyles.callBtn} />
    </Animated.View>
  );
}

const skelStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MC.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: MC.border,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: MC.surfaceLift },
  lines: { flex: 1, gap: 8 },
  lineWide: { height: 12, borderRadius: 6, backgroundColor: MC.surfaceLift, width: '60%' },
  lineNarrow: { height: 10, borderRadius: 5, backgroundColor: MC.surfaceLift, width: '40%' },
  badge: { width: 70, height: 22, borderRadius: 999, backgroundColor: MC.surfaceLift },
  callBtn: { width: 50, height: 36, borderRadius: 18, backgroundColor: MC.surfaceLift },
});

// ─────────────────────────────────────────────────────────────────
// EmployeeRow
// ─────────────────────────────────────────────────────────────────
const EmployeeRow = memo(function EmployeeRow({
  employee,
  index,
  onCall,
  onEdit,
  onDelete,
}: {
  employee: Employee;
  index: number;
  onCall: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}) {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: Math.min(index * 40, 400),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 260,
        delay: Math.min(index * 40, 400),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacityAnim, slideAnim]);

  const initial = employee.name.charAt(0).toUpperCase();
  const accentColor = avatarColor(employee.name);
  const canCall = Boolean(employee.fcm_token);

  return (
    <Animated.View
      style={[
        rowStyles.card,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={[rowStyles.avatarRing, { borderColor: accentColor }]}>
        <View style={[rowStyles.avatar, { backgroundColor: `${accentColor}18` }]}>
          <Text style={[rowStyles.initial, { color: accentColor }]}>{initial}</Text>
        </View>
        {employee.is_active && (
          <View style={rowStyles.activeDot}>
            <PulseDot color={MC.green} size={7} />
          </View>
        )}
      </View>

      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>{employee.name}</Text>
        <Text style={rowStyles.email} numberOfLines={1}>{employee.email}</Text>
        {!employee.is_active && <Text style={rowStyles.inactiveText}>Inactive</Text>}
      </View>

      <View style={[
        rowStyles.badge,
        {
          backgroundColor: employee.role === 'admin' ? MC.goldDim : MC.blueDim,
          borderColor: employee.role === 'admin' ? `${MC.gold}44` : `${MC.blue}44`,
        },
      ]}>
        <Text style={[
          rowStyles.badgeText,
          { color: employee.role === 'admin' ? MC.gold : MC.blue },
        ]}>
          {employee.role.toUpperCase()}
        </Text>
      </View>

      <View style={rowStyles.actionsCol}>
        <TouchableOpacity
          style={[rowStyles.iconBtn, rowStyles.editBtn]}
          onPress={() => onEdit(employee)}
          activeOpacity={0.75}
        >
          <Pencil size={13} color={MC.blue} strokeWidth={2.4} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[rowStyles.iconBtn, rowStyles.deleteBtn]}
          onPress={() => onDelete(employee)}
          activeOpacity={0.75}
        >
          <Trash2 size={13} color={MC.rose} strokeWidth={2.4} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[rowStyles.callBtn, canCall ? rowStyles.callBtnActive : rowStyles.callBtnDisabled]}
          onPress={() => onCall(employee)}
          disabled={!canCall}
          activeOpacity={0.75}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Phone size={13} color={canCall ? MC.bg : MC.textFaint} strokeWidth={2.5} />
          {canCall && <Text style={rowStyles.callLabel}>Call</Text>}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

const rowStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MC.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 12,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: MF.display,
  },
  activeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: MC.surface,
    borderRadius: 6,
    padding: 1,
  },
  info: { flex: 1 },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: MC.textPrimary,
    fontFamily: MF.display,
  },
  email: {
    fontSize: 11,
    color: MC.textSub,
    fontFamily: MF.mono,
    marginTop: 2,
  },
  inactiveText: {
    fontSize: 10,
    color: MC.rose,
    fontFamily: MF.mono,
    marginTop: 4,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 1,
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: MC.blueDim,
    borderColor: `${MC.blue}44`,
  },
  deleteBtn: {
    backgroundColor: MC.roseDim,
    borderColor: `${MC.rose}44`,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  callBtnActive: {
    backgroundColor: MC.green,
    borderColor: MC.green,
    shadowColor: MC.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  callBtnDisabled: {
    backgroundColor: MC.surfaceAlt,
    borderColor: MC.border,
    opacity: 0.4,
  },
  callLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: MC.bg,
    fontFamily: MF.mono,
    letterSpacing: 0.3,
  },
});

// ─────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, scaleAnim]);

  const Icon: LucideIcon = hasSearch ? Search : Users;

  return (
    <Animated.View style={[emptyStyles.wrap, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={emptyStyles.card}>
        <View style={emptyStyles.iconWrap}>
          <Icon size={36} color={MC.textFaint} strokeWidth={1.3} />
        </View>
        <Text style={emptyStyles.title}>
          {hasSearch ? 'No results found' : 'No employees yet'}
        </Text>
        <Text style={emptyStyles.sub}>
          {hasSearch
            ? 'Try a different name or email.'
            : 'Tap + Add to create your first employee.'}
        </Text>
      </View>
    </Animated.View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 24 },
  card: {
    backgroundColor: MC.surface,
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: MC.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700', color: MC.textPrimary, fontFamily: MF.display },
  sub: {
    fontSize: 12,
    color: MC.textSub,
    fontFamily: MF.mono,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 18,
  },
});

// ─────────────────────────────────────────────────────────────────
// Field
// ─────────────────────────────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={modalStyles.fieldWrap}>
      <Text style={modalStyles.label}>{label}</Text>
      {children}
      {error ? <Text style={modalStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// CreateModal
// ─────────────────────────────────────────────────────────────────
function CreateModal({
  visible,
  onClose,
  onCreated,
  disabled,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  disabled: boolean;
}) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const setField = (k: keyof CreateForm, v: string) => {
    setForm(f => ({ ...f, [k]: v as never }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};

    if (!form.name.trim()) e.name = 'Name is required';

    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';

    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (disabled) {
      Alert.alert('Offline', 'You are offline. Connect to the internet to create a new employee.');
      return;
    }

    if (!validate()) return;

    setLoading(true);
    try {
      await apiPost('/admin/employees', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: 'employee',
      });

      setForm(EMPTY_FORM);
      setErrors({});
      onCreated();
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to create employee';
      if (String(msg).toLowerCase().includes('already')) {
        setErrors({ email: 'Email already registered' });
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: MC.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={modalStyles.sheet}
          contentContainerStyle={modalStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={modalStyles.handle} />

          <View style={modalStyles.header}>
            <View>
              <Text style={modalStyles.title}>New Employee</Text>
              <Text style={modalStyles.titleSub}>
                {disabled
                  ? 'You are offline. Creation will be available when online.'
                  : 'Add a new team member to your workspace.'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={modalStyles.closeBtn}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <X size={14} color={MC.textSub} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <Field label="Full Name" error={errors.name}>
            <TextInput
              style={[modalStyles.input, errors.name ? modalStyles.inputError : null]}
              placeholder="Jane Doe"
              placeholderTextColor={MC.textFaint}
              value={form.name}
              onChangeText={v => setField('name', v)}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={!loading && !disabled}
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <TextInput
              ref={emailRef}
              style={[modalStyles.input, errors.email ? modalStyles.inputError : null]}
              placeholder="jane@company.com"
              placeholderTextColor={MC.textFaint}
              value={form.email}
              onChangeText={v => setField('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading && !disabled}
            />
          </Field>

          <Field label="Password" error={errors.password}>
            <TextInput
              ref={passwordRef}
              style={[modalStyles.input, errors.password ? modalStyles.inputError : null]}
              placeholder="Minimum 6 characters"
              placeholderTextColor={MC.textFaint}
              value={form.password}
              onChangeText={v => setField('password', v)}
              secureTextEntry
              returnKeyType="done"
              editable={!loading && !disabled}
            />
          </Field>

          <View style={modalStyles.roleInfoBox}>
            <User size={14} color={MC.blue} strokeWidth={2} />
            <Text style={modalStyles.roleInfoText}>
              New users created here are added as employees in your own team.
            </Text>
          </View>

          <View style={modalStyles.divider} />

          <TouchableOpacity
            style={[modalStyles.createBtn, (loading || disabled) && { opacity: 0.6 }]}
            onPress={handleCreate}
            activeOpacity={0.82}
            disabled={loading || disabled}
          >
            {loading ? (
              <ActivityIndicator color={MC.bg} />
            ) : (
              <Text style={modalStyles.createBtnText}>
                {disabled ? 'Offline' : 'Create Employee'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// EditModal
// ─────────────────────────────────────────────────────────────────
function EditModal({
  visible,
  employee,
  onClose,
  onSaved,
  disabled,
}: {
  visible: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
  disabled: boolean;
}) {
  const [form, setForm] = useState<EditForm>({
    name: '',
    role: 'employee',
    is_active: true,
  });
  const [errors, setErrors] = useState<EditErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        role: employee.role,
        is_active: employee.is_active,
      });
      setErrors({});
    }
  }, [employee]);

  const validate = () => {
    const e: EditErrors = {};
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!employee) return;

    if (disabled) {
      Alert.alert('Offline', 'Connect to the internet to update this employee.');
      return;
    }

    if (!validate()) return;

    setLoading(true);
    try {
      await apiPatch(`/admin/employees/${employee.id}`, {
        name: form.name.trim(),
        role: form.role,
        is_active: form.is_active,
      });
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: MC.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={modalStyles.sheet}
          contentContainerStyle={modalStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={modalStyles.handle} />

          <View style={modalStyles.header}>
            <View>
              <Text style={modalStyles.title}>Edit Employee</Text>
              <Text style={modalStyles.titleSub}>
                Update role, name, or active status.
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={modalStyles.closeBtn}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <X size={14} color={MC.textSub} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <Field label="Full Name" error={errors.name}>
            <TextInput
              style={[modalStyles.input, errors.name ? modalStyles.inputError : null]}
              placeholder="Jane Doe"
              placeholderTextColor={MC.textFaint}
              value={form.name}
              onChangeText={v => {
                setForm(f => ({ ...f, name: v }));
                setErrors(e => ({ ...e, name: undefined }));
              }}
              editable={!loading && !disabled}
            />
          </Field>

          <Field label="Role">
            <View style={editStyles.roleRow}>
              <TouchableOpacity
                style={[
                  editStyles.roleBtn,
                  form.role === 'employee' && editStyles.roleBtnActive,
                ]}
                onPress={() => setForm(f => ({ ...f, role: 'employee' }))}
                disabled={loading || disabled}
              >
                <Text style={[
                  editStyles.roleBtnText,
                  form.role === 'employee' && editStyles.roleBtnTextActive,
                ]}>
                  Employee
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  editStyles.roleBtn,
                  form.role === 'admin' && editStyles.roleBtnActiveGold,
                ]}
                onPress={() => setForm(f => ({ ...f, role: 'admin' }))}
                disabled={loading || disabled}
              >
                <Text style={[
                  editStyles.roleBtnText,
                  form.role === 'admin' && editStyles.roleBtnTextActiveGold,
                ]}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          </Field>

          <Field label="Active Status">
            <View style={editStyles.switchRow}>
              <View>
                <Text style={editStyles.switchTitle}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </Text>
                <Text style={editStyles.switchSub}>
                  Inactive users cannot use the app until re-enabled.
                </Text>
              </View>

              <Switch
                value={form.is_active}
                onValueChange={v => setForm(f => ({ ...f, is_active: v }))}
                disabled={loading || disabled}
                trackColor={{ false: MC.surfaceLift, true: `${MC.green}66` }}
                thumbColor={form.is_active ? MC.green : MC.textSub}
              />
            </View>
          </Field>

          <View style={modalStyles.divider} />

          <TouchableOpacity
            style={[modalStyles.createBtn, (loading || disabled) && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.82}
            disabled={loading || disabled}
          >
            {loading ? (
              <ActivityIndicator color={MC.bg} />
            ) : (
              <Text style={modalStyles.createBtnText}>
                {disabled ? 'Offline' : 'Save Changes'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    backgroundColor: MC.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MC.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: MC.blueDim,
    borderColor: `${MC.blue}44`,
  },
  roleBtnActiveGold: {
    backgroundColor: MC.goldDim,
    borderColor: `${MC.gold}44`,
  },
  roleBtnText: {
    color: MC.textSub,
    fontFamily: MF.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  roleBtnTextActive: {
    color: MC.blue,
  },
  roleBtnTextActiveGold: {
    color: MC.gold,
  },
  switchRow: {
    backgroundColor: MC.surface,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  switchTitle: {
    color: MC.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: MF.display,
  },
  switchSub: {
    color: MC.textFaint,
    fontSize: 11,
    fontFamily: MF.mono,
    marginTop: 4,
    maxWidth: 220,
  },
});

const modalStyles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: MC.bg },
  content: { padding: 24, paddingBottom: 52 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: MC.borderBright,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
  },
  titleSub: {
    fontSize: 11,
    color: MC.textFaint,
    fontFamily: MF.mono,
    marginTop: 3,
  },
  closeBtn: {
    backgroundColor: MC.surfaceLift,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MC.border,
  },
  fieldWrap: { marginBottom: 18 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: MC.textFaint,
    fontFamily: MF.mono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: MC.surface,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: MC.textPrimary,
    fontFamily: MF.mono,
  },
  inputError: {
    borderColor: MC.rose,
    borderTopColor: MC.rose,
  },
  errorText: {
    fontSize: 11,
    color: MC.rose,
    fontFamily: MF.mono,
    marginTop: 5,
  },
  roleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MC.blueDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${MC.blue}33`,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  roleInfoText: {
    flex: 1,
    fontSize: 11,
    color: MC.blue,
    fontFamily: MF.mono,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: MC.border,
    marginVertical: 20,
  },
  createBtn: {
    backgroundColor: MC.green,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: MC.green,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  createBtnText: {
    color: MC.bg,
    fontWeight: '800',
    fontSize: 14,
    fontFamily: MF.mono,
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────
function ScreenHeader({ total }: { total: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View style={[hdrStyles.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={hdrStyles.titleRow}>
        <Text style={hdrStyles.title}>Employees</Text>
        <View style={hdrStyles.chip}>
          <Text style={hdrStyles.chipText}>{total} total</Text>
        </View>
      </View>
      <Text style={hdrStyles.sub}>Manage your team members</Text>
    </Animated.View>
  );
}

const hdrStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: MC.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: MC.textPrimary,
    fontFamily: MF.display,
    letterSpacing: 0.3,
  },
  chip: {
    backgroundColor: MC.blueDim,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${MC.blue}44`,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    color: MC.blue,
    fontFamily: MF.mono,
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 11,
    color: MC.textFaint,
    fontFamily: MF.mono,
  },
});

// ─────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────
export default function EmployeesScreen() {
  const navigation = useNavigation<AdminNav>();
  const isOnline = useOfflineStore(s => s.isOnline);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await apiGet<Employee[]>('/admin/employees');
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log('[EmployeesScreen] fetchEmployees error:', e);
      Alert.alert('Error', e?.message ?? 'Failed to load employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleCall = useCallback((employee: Employee) => {
    if (!employee.fcm_token) {
      Alert.alert('Cannot Call', `${employee.name} has not logged in on any device yet.`);
      return;
    }

    navigation.navigate('Call', {
      employeeId: employee.id,
      employeeName: employee.name,
    });
  }, [navigation]);

  const handleEdit = useCallback((employee: Employee) => {
    setEditingEmployee(employee);
  }, []);

  const handleDelete = useCallback((employee: Employee) => {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to the internet to delete this employee.');
      return;
    }

    Alert.alert(
      'Delete Employee',
      `Are you sure you want to delete ${employee.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoadingId(employee.id);
              await apiDelete(`/admin/employees/${employee.id}`);
              setEmployees(prev => prev.filter(e => e.id !== employee.id));
              Alert.alert('Deleted', `${employee.name} has been deleted.`);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to delete employee');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [isOnline]);

  const query = search.trim().toLowerCase();
  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(query) ||
    e.email.toLowerCase().includes(query),
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {!isOnline && (
        <View style={s.offlineBanner}>
          <CloudOff size={12} color={MC.rose} />
          <Text style={s.offlineText}>
            You are offline. Employee list may be stale; changes are disabled.
          </Text>
        </View>
      )}

      <View style={s.container}>
        <ScreenHeader total={employees.length} />

        <View style={s.toolbar}>
          <View style={s.searchWrap}>
            <Search size={14} color={MC.textFaint} strokeWidth={2} />
            <TextInput
              style={s.search}
              placeholder="Search by name or email…"
              placeholderTextColor={MC.textFaint}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <X size={13} color={MC.textFaint} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[s.addBtn, !isOnline && { opacity: 0.6 }]}
            onPress={() => {
              if (!isOnline) {
                Alert.alert(
                  'Offline',
                  'You are offline. Connect to the internet to add a new employee.',
                );
                return;
              }
              setShowCreate(true);
            }}
            activeOpacity={0.82}
          >
            <UserPlus size={14} color={MC.bg} strokeWidth={2.5} />
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {!loading && search.length > 0 && (
          <Text style={s.resultsLabel}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
          </Text>
        )}

        {actionLoadingId && (
          <View style={s.actionOverlay}>
            <ActivityIndicator color={MC.green} />
            <Text style={s.actionOverlayText}>Updating employee…</Text>
          </View>
        )}

        {loading ? (
          <View style={s.list}>
            {[...Array(7)].map((_, i) => <SkeletonCard key={i} />)}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={e => e.id}
            contentContainerStyle={filtered.length === 0 ? s.emptyList : s.list}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item, index }) => (
              <EmployeeRow
                employee={item}
                index={index}
                onCall={handleCall}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
            ListEmptyComponent={<EmptyState hasSearch={search.length > 0} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchEmployees(true)}
                tintColor={MC.green}
                colors={[MC.green]}
              />
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <CreateModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchEmployees();
            Alert.alert('Employee Created', 'They can now log in with their credentials.');
          }}
          disabled={!isOnline}
        />

        <EditModal
          visible={!!editingEmployee}
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSaved={() => {
            setEditingEmployee(null);
            fetchEmployees();
            Alert.alert('Updated', 'Employee details were updated successfully.');
          }}
          disabled={!isOnline}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MC.bg },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: MC.roseDim,
    borderBottomWidth: 1,
    borderBottomColor: `${MC.rose}44`,
  },
  offlineText: {
    flex: 1,
    fontSize: 11,
    color: MC.rose,
    fontFamily: MF.mono,
  },

  container: { flex: 1, backgroundColor: MC.bg },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MC.border,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MC.surface,
    borderWidth: 1,
    borderColor: MC.border,
    borderTopColor: MC.borderBright,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  search: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 13,
    color: MC.textPrimary,
    fontFamily: MF.mono,
  },
  addBtn: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    backgroundColor: MC.green,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: MC.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  addBtnText: {
    color: MC.bg,
    fontWeight: '800',
    fontSize: 13,
    fontFamily: MF.mono,
  },
  resultsLabel: {
    fontSize: 10,
    color: MC.textFaint,
    fontFamily: MF.mono,
    paddingHorizontal: 18,
    paddingTop: 10,
    letterSpacing: 0.5,
  },
  list: { padding: 16, paddingBottom: 40 },
  emptyList: { flexGrow: 1, padding: 16 },
  actionOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  actionOverlayText: {
    color: MC.textSub,
    fontFamily: MF.mono,
    fontSize: 11,
  },
});