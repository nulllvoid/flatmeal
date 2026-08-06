import { Redirect } from 'expo-router';

// TODO: once Supabase auth is wired up, check session + flat membership here
// and redirect to /onboarding when there's no session or no flat yet.
export default function RootIndex() {
  return <Redirect href="/(tabs)" />;
}
