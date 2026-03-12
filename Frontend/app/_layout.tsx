import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="LoginScreen" options={{ headerShown: false }} />
        <Stack.Screen name="RegistrationScreen" options={{ headerShown: false }} />
        <Stack.Screen name="CommunityScreen" options={{ headerShown: false }} />
        <Stack.Screen name="RaisePetitionScreen" options={{ title: 'Raise Petition' }} />
        <Stack.Screen name="RaiseComplaintScreen" options={{ title: 'Raise Complaint' }} />
        <Stack.Screen name="ViewComplaintsScreen" options={{ title: 'View Complaints' }} />
        <Stack.Screen name="ViewPetitionsScreen" options={{ title: 'View Petitions' }} />
        <Stack.Screen name="AnonymousMessageScreen" options={{ title: 'Anonymous Message' }} />
        <Stack.Screen name="AnonymousMessagesAdminScreen" options={{ title: 'Admin - Anonymous Messages' }} />
        <Stack.Screen name="AnonymousThreadScreen" options={{ title: 'Chat' }} />
        <Stack.Screen name="EventsScreen" options={{ title: 'Events' }} />
        <Stack.Screen name="EventsScreenMember" options={{ title: 'Events' }} />
        <Stack.Screen name="PollsListScreen" options={{ title: 'Polling', headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
