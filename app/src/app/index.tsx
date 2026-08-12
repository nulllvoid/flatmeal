import { Redirect } from 'expo-router';

import { useActiveGroup } from '@/contexts/active-group';
import { useSession } from '@/hooks/use-session';

export default function RootIndex() {
  const session = useSession();
  const { groups } = useActiveGroup();

  if (session === undefined || (session && groups === undefined)) {
    return null; // loading — TODO: splash/spinner
  }

  if (!session || !groups || groups.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
