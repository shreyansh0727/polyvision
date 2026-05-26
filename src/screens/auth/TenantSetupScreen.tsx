// src/screens/auth/TenantSetupScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import {
  Building2,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react-native';

import { apiPost } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useOfflineStore } from '../../store/offlineStore';
import { MC, MF } from '../../navigation/AppTheme';

type CreateOrderResponse = {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
};

function formatAmountInr(paise?: number | null) {
  const value = (paise ?? 0) / 100;
  return `₹${value.toFixed(0)}`;
}

export default function TenantSetupScreen() {
  const employee = useAuthStore(s => s.employee);
  const refreshMe = useAuthStore(s => s.refreshMe);
  const isOnline = useOfflineStore(s => s.isOnline);

  const [companyName, setCompanyName] = useState(employee?.company_name ?? '');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'setup' | 'payment'>(
    employee?.tenant_id ? 'payment' : 'setup'
  );

  const hasTenant = !!employee?.tenant_id;
  const plan = employee?.plan ?? null;
  const needsPayment = hasTenant && plan !== 'active';

  const canSubmitCompany = useMemo(() => {
    return companyName.trim().length >= 2;
  }, [companyName]);

  const createTenant = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to the internet to continue.');
      return false;
    }

    if (!canSubmitCompany) {
      Alert.alert('Company name required', 'Please enter your company or team name.');
      return false;
    }

    try {
      setLoading(true);

      await apiPost('/tenant/register', {
        company_name: companyName.trim(),
      });

      await refreshMe();
      setStep('payment');
      return true;
    } catch (e: any) {
      const message = e?.message ?? 'Failed to create tenant.';
      Alert.alert('Setup failed', message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startPayment = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to the internet to continue.');
      return;
    }

    try {
      setLoading(true);

      const order = await apiPost('/payment/create-order', {}) as CreateOrderResponse;

      const options = {
        description: 'One-time activation payment',
        currency: order.currency,
        key: order.key_id,
        amount: order.amount,
        name: companyName?.trim() || employee?.company_name || 'Team Workspace',
        order_id: order.order_id,
        prefill: {
          email: employee?.email ?? '',
          name: employee?.name ?? '',
        },
        theme: {
          color: MC.green,
        },
      };

      setLoading(false);

      const result = await RazorpayCheckout.open(options);

      setLoading(true);

      await apiPost('/payment/verify', {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      await refreshMe();

      Alert.alert(
        'Payment successful',
        'Your workspace is now active.',
        [{ text: 'Continue' }]
      );
    } catch (e: any) {
      setLoading(false);

      const code = e?.code;
      const description = e?.description || e?.message || '';

      if (code || description) {
        Alert.alert(
          'Payment not completed',
          description || 'The payment was cancelled or failed.'
        );
        return;
      }

      Alert.alert(
        'Activation failed',
        e?.message ?? 'Unable to verify payment. Please contact support if amount was deducted.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (!hasTenant) {
      const ok = await createTenant();
      if (!ok) return;
      return;
    }

    if (needsPayment) {
      await startPayment();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badge}>
          <ShieldCheck size={14} color={MC.green} strokeWidth={2} />
          <Text style={styles.badgeText}>WORKSPACE ACTIVATION</Text>
        </View>

        <Text style={styles.title}>
          Set up your{'\n'}admin workspace.
        </Text>

        <Text style={styles.subtitle}>
          Create your private team space and activate it with a one-time payment.
        </Text>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconWrap}>
              <Building2 size={18} color={MC.green} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Company details</Text>
              <Text style={styles.sectionSub}>
                This name is used for your independent admin workspace.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Company / Team Name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              editable={!loading && !hasTenant}
              placeholder="Acme Field Ops"
              placeholderTextColor={MC.textFaint}
              style={styles.input}
            />
          </View>

          {hasTenant ? (
            <View style={styles.doneRow}>
              <CheckCircle2 size={15} color={MC.green} />
              <Text style={styles.doneText}>
                Workspace created for {employee?.company_name || companyName}.
              </Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              Each admin gets a separate independent team.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconWrap}>
              <CreditCard size={18} color={MC.green} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Activation payment</Text>
              <Text style={styles.sectionSub}>
                One-time payment to activate your workspace.
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Amount</Text>
            <Text style={styles.priceValue}>{formatAmountInr(99900)}</Text>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Current status</Text>
            <Text style={styles.statusValue}>
              {!hasTenant ? 'Tenant setup pending' : plan === 'active' ? 'Active' : 'Payment pending'}
            </Text>
          </View>

          <Text style={styles.hint}>
            Payment is processed securely through Razorpay.
          </Text>
        </View>

        {plan === 'active' ? (
          <View style={styles.activeBox}>
            <CheckCircle2 size={18} color={MC.green} />
            <Text style={styles.activeText}>
              Your workspace is active. You can continue to the admin app.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.cta, loading && { opacity: 0.7 }]}
            onPress={handlePrimaryAction}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={MC.bg} />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {!hasTenant ? 'Create workspace' : 'Pay & activate'}
                </Text>
                <ArrowRight size={16} color={MC.bg} strokeWidth={2.4} />
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MC.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 42,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${MC.green}14`,
    borderWidth: 1,
    borderColor: `${MC.green}33`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  badgeText: {
    color: MC.green,
    fontSize: 10,
    fontFamily: MF.mono,
    letterSpacing: 1.8,
    fontWeight: '800',
  },
  title: {
    color: MC.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: MF.display,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: MC.textSub,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: MF.mono,
    marginBottom: 28,
  },
  card: {
    backgroundColor: MC.surface,
    borderWidth: 1,
    borderColor: MC.borderBright,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${MC.green}12`,
    borderWidth: 1,
    borderColor: `${MC.green}25`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: MC.textPrimary,
    fontSize: 14,
    fontFamily: MF.display,
    fontWeight: '800',
    marginBottom: 3,
  },
  sectionSub: {
    color: MC.textFaint,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: MF.mono,
  },
  label: {
    color: MC.textFaint,
    fontSize: 10,
    fontFamily: MF.mono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrap: {
    backgroundColor: MC.surfaceAlt,
    borderWidth: 1.5,
    borderColor: MC.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    color: MC.textPrimary,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: MF.mono,
  },
  hint: {
    color: MC.textFaint,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: MF.mono,
    marginTop: 8,
  },
  doneRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneText: {
    color: MC.green,
    fontSize: 11,
    fontFamily: MF.mono,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  priceLabel: {
    color: MC.textSub,
    fontSize: 12,
    fontFamily: MF.mono,
  },
  priceValue: {
    color: MC.textPrimary,
    fontSize: 24,
    fontFamily: MF.display,
    fontWeight: '800',
  },
  statusBox: {
    backgroundColor: MC.surfaceAlt,
    borderWidth: 1,
    borderColor: MC.border,
    borderRadius: 12,
    padding: 12,
  },
  statusLabel: {
    color: MC.textFaint,
    fontSize: 10,
    fontFamily: MF.mono,
    marginBottom: 4,
  },
  statusValue: {
    color: MC.textPrimary,
    fontSize: 13,
    fontFamily: MF.display,
    fontWeight: '700',
  },
  activeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${MC.green}12`,
    borderWidth: 1,
    borderColor: `${MC.green}25`,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  activeText: {
    flex: 1,
    color: MC.green,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: MF.mono,
  },
  cta: {
    marginTop: 8,
    backgroundColor: MC.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  ctaText: {
    color: MC.bg,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: MF.mono,
    letterSpacing: 1.6,
  },
});