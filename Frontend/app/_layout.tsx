import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { createContext, useState, useCallback, useEffect } from 'react';
import { WallpaperProvider } from '../context/WallpaperContext';
import { GlobalBackground } from '../components/GlobalBackground';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AppContext = createContext({ 
  theme: 'light', 
  toggleTheme: () => { },
  setTheme: (theme: 'light' | 'dark') => { } 
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('APP_THEME');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeState(savedTheme);
        } else {
          setThemeState(colorScheme === 'dark' ? 'dark' : 'light');
        }
      } catch (e) {
        console.error('Failed to load theme', e);
        setThemeState(colorScheme === 'dark' ? 'dark' : 'light');
      } finally {
        setIsThemeLoaded(true);
      }
    };
    loadTheme();
  }, [colorScheme]);

  const setTheme = useCallback(async (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem('APP_THEME', newTheme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded || !isThemeLoaded) return null;

  return (
    <AppContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <WallpaperProvider>
        <GlobalBackground>
          <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ 
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' } 
            }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="LoginScreen" options={{ headerShown: false }} />
              <Stack.Screen name="RegistrationScreen" options={{ headerShown: false }} />
              <Stack.Screen name="CommunityScreen" options={{ headerShown: false }} />
              <Stack.Screen name="ProfileScreen" options={{ title: 'Profile', headerShown: true }} />
              <Stack.Screen name="SettingScreen" options={{ title: 'Settings', headerShown: true }} />
              <Stack.Screen name="ChangePasswordScreen" options={{ title: 'Change Password', headerShown: true }} />
              <Stack.Screen name="wallpaper" options={{ title: 'Wallpaper', headerShown: true }} />
              <Stack.Screen name="RaisePetitionScreen" options={{ title: 'Raise Petition', headerShown: true }} />
              <Stack.Screen name="RaiseComplaintScreen" options={{ title: 'Raise Complaint', headerShown: true }} />
              <Stack.Screen name="ViewComplaintsScreen" options={{ title: 'View Complaints', headerShown: true }} />
              <Stack.Screen name="ViewPetitionsScreen" options={{ title: 'View Petitions', headerShown: true }} />
              <Stack.Screen name="AnonymousMessageScreen" options={{ title: 'Anonymous Message', headerShown: true }} />
              <Stack.Screen name="AnonymousMessagesAdminScreen" options={{ title: 'Admin - Anonymous Messages', headerShown: true }} />
              <Stack.Screen name="AnonymousThreadScreen" options={{ title: 'Chat', headerShown: true }} />
              <Stack.Screen name="ChatWithModeration" options={{ title: 'AI Assistant', headerShown: false }} />
              <Stack.Screen name="AIChatScreen" options={{ title: 'AI Chat', headerShown: false }} />
              <Stack.Screen name="ComplaintAIChatScreen" options={{ title: 'Complaint AI', headerShown: false }} />
              <Stack.Screen name="PetitionAIChatScreen" options={{ title: 'Petition AI', headerShown: false }} />
              <Stack.Screen name="EventsScreen" options={{ title: 'Events', headerShown: true }} />
              <Stack.Screen name="EventsScreenMember" options={{ title: 'Events', headerShown: true }} />
              <Stack.Screen name="PollsListScreen" options={{ title: 'Polling', headerShown: false }} />
              <Stack.Screen name="PollVoteScreen" options={{ title: 'Poll', headerShown: true }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          </ThemeProvider>
        </GlobalBackground>
      </WallpaperProvider>
    </AppContext.Provider>
  );
}
