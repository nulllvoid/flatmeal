import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// S0 step 1: phone number → OTP → session.
// Steps 2 (create/join flat, dietary profile, cook details, poll timings)
// and 3 (push permission) live in sibling screens once auth is wired up:
//   onboarding/create-flat.tsx, onboarding/join-flat.tsx,
//   onboarding/dietary-profile.tsx, onboarding/cook-details.tsx
export default function OnboardingPhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  async function sendOtp() {
    // TODO: supabase.auth.signInWithOtp({ phone })
    setOtpSent(true);
  }

  async function verifyOtp() {
    // TODO: supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
    // then check flat_members for an existing flat; if none, go to create/join.
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">FlatMeal</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Vote in 5 seconds. Your cook gets clear instructions, automatically.
        </ThemedText>

        {!otpSent ? (
          <>
            <TextInput
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
            />
            <Pressable style={styles.primaryButton} onPress={sendOtp}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                Send OTP
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              placeholder="6-digit code"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              style={styles.input}
            />
            <Pressable style={styles.primaryButton} onPress={verifyOtp}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                Verify
              </ThemedText>
            </Pressable>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderColor: '#00000030',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
});
