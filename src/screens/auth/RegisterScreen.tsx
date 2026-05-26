// src/screens/auth/RegisterScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const signup = useAuthStore((s) => s.signup);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const error = useMemo(() => localError ?? storeError, [localError, storeError]);

  const clearAllErrors = () => {
    setLocalError(null);
    clearError();
  };

  const validate = () => {
    const cleanName = name.trim();
    const cleanCompany = companyName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanCompany || !cleanEmail || !password || !confirmPassword) {
      return 'Please fill in all fields.';
    }

    if (cleanName.length < 2) {
      return 'Please enter your full name.';
    }

    if (cleanCompany.length < 2) {
      return 'Please enter your company name.';
    }

    if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      return 'Please enter a valid email address.';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }

    return null;
  };

  const onSignup = async () => {
    clearAllErrors();

    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      await signup({
        name: name.trim(),
        company_name: companyName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
    } catch {
      // store error is already handled in authStore
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>OWNER SIGNUP</Text>
              <Text style={styles.title}>Create your workspace</Text>
              <Text style={styles.subtitle}>
                Start your company account, set up your team, and continue to payment.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    if (error) clearAllErrors();
                  }}
                  placeholder="Asha Gupta"
                  placeholderTextColor="#8A95A8"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Company name</Text>
                <TextInput
                  value={companyName}
                  onChangeText={(v) => {
                    setCompanyName(v);
                    if (error) clearAllErrors();
                  }}
                  placeholder="Acme Services"
                  placeholderTextColor="#8A95A8"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Work email</Text>
                <TextInput
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (error) clearAllErrors();
                  }}
                  placeholder="asha@acme.com"
                  placeholderTextColor="#8A95A8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (error) clearAllErrors();
                  }}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#8A95A8"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    if (error) clearAllErrors();
                  }}
                  placeholder="Re-enter password"
                  placeholderTextColor="#8A95A8"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={onSignup}
                disabled={loading}
                activeOpacity={0.86}
              >
                {loading ? (
                  <ActivityIndicator color="#080C14" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create workspace</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.helperText}>
                Your account will be created as the team owner. Billing can be completed after signup.
              </Text>

              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.secondaryAction}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryActionText}>
                  Already have an account? Sign in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 28,
  },
  eyebrow: {
    color: '#10D876',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  title: {
    color: '#E8EDF5',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    color: '#8A95A8',
    fontSize: 14,
    lineHeight: 22,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 7,
  },
  label: {
    color: '#E8EDF5',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#131B28',
    borderWidth: 1,
    borderColor: '#1C2840',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#E8EDF5',
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: 'rgba(240,90,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,90,126,0.28)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: '#F05A7E',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#10D876',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: '#080C14',
    fontSize: 15,
    fontWeight: '800',
  },
  helperText: {
    color: '#8A95A8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 2,
  },
  secondaryAction: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryActionText: {
    color: '#10D876',
    fontSize: 14,
    fontWeight: '700',
  },
});