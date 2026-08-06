import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="grocery-list"
          options={{ headerShown: true, title: "Grocery list", presentation: 'card' }}
        />
        <Stack.Screen
          name="cook-message-preview"
          options={{ headerShown: true, title: 'Cook message', presentation: 'modal' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
