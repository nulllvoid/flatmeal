import { Redirect } from 'expo-router';

import { useMyFlat } from '@/hooks/use-my-flat';
import { useSession } from '@/hooks/use-session';

export default function RootIndex() {
  const session = useSession();
  const flatId = useMyFlat(session);

  if (session === undefined || (session && flatId === undefined)) {
    return null; // loading — TODO: splash/spinner
  }

  if (!session || !flatId) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
