import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createContext, useState, useCallback, useEffect } from 'react';
import { WallpaperProvider } from '../context/WallpaperContext';
import { GlobalBackground } from '../components/GlobalBackground';

export const AppContext = createContext({ theme: 'light', toggleTheme: () => { } });

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState<'light' | 'dark'>(colorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    setTheme(colorScheme === 'dark' ? 'dark' : 'light');
  }, [colorScheme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <AppContext.Provider value={{ theme, toggleTheme }}>
      <WallpaperProvider>
        <GlobalBackground>
          <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="LoginScreen" options={{ headerShown: false }} />
              <Stack.Screen name="RegistrationScreen" options={{ headerShown: false }} />
              <Stack.Screen name="CommunityScreen" options={{ headerShown: false }} />
              <Stack.Screen name="ProfileScreen" options={{ title: 'Profile' }} />
              <Stack.Screen name="SettingScreen" options={{ title: 'Settings' }} />
              <Stack.Screen name="ChangePasswordScreen" options={{ title: 'Change Password' }} />
              <Stack.Screen name="wallpaper" options={{ title: 'Wallpaper' }} />
              <Stack.Screen name="RaisePetitionScreen" options={{ title: 'Raise Petition' }} />
              <Stack.Screen name="RaiseComplaintScreen" options={{ title: 'Raise Complaint' }} />
              <Stack.Screen name="ViewComplaintsScreen" options={{ title: 'View Complaints' }} />
              <Stack.Screen name="ViewPetitionsScreen" options={{ title: 'View Petitions' }} />
              <Stack.Screen name="AnonymousMessageScreen" options={{ title: 'Anonymous Message' }} />
              <Stack.Screen name="AnonymousMessagesAdminScreen" options={{ title: 'Admin - Anonymous Messages' }} />
               <Stack.Screen name="AnonymousThreadScreen" options={{ title: 'Chat' }} />
               <Stack.Screen name="ChatWithModeration" options={{ title: 'AI Assistant', headerShown: false }} />
               <Stack.Screen name="AIChatScreen" options={{ title: 'AI Chat', headerShown: false }} />
               <Stack.Screen name="ComplaintAIChatScreen" options={{ title: 'Complaint AI', headerShown: false }} />
               <Stack.Screen name="PetitionAIChatScreen" options={{ title: 'Petition AI', headerShown: false }} />
               <Stack.Screen name="EventsScreen" options={{ title: 'Events' }} />
              <Stack.Screen name="EventsScreenMember" options={{ title: 'Events' }} />
              <Stack.Screen name="PollsListScreen" options={{ title: 'Polling', headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </ThemeProvider>
        </GlobalBackground>
      </WallpaperProvider>
    </AppContext.Provider>
  );
}
