import React, { useContext } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallpaper } from '../context/WallpaperContext';
import { AppContext } from '../app/_layout';

const { width, height } = Dimensions.get('window');

interface GlobalBackgroundProps {
  children: React.ReactNode;
}

export const GlobalBackground: React.FC<GlobalBackgroundProps> = ({ children }) => {
  const { wallpaper, blur } = useWallpaper();
  const { theme } = useContext(AppContext);

  const renderBackground = () => {
    if (!wallpaper) return null;

    if (wallpaper.type === 'image') {
      return (
        <Image
          source={{ uri: wallpaper.value }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      );
    }

    if (wallpaper.type === 'gradient') {
      return (
        <LinearGradient
          colors={wallpaper.value as [string, string, ...string[]]}
          style={StyleSheet.absoluteFill}
        />
      );
    }

    return null;
  };

  const containerStyle = [
    styles.container,
    { backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc' }
  ];

  return (
    <View style={containerStyle}>
      {renderBackground()}
      {wallpaper && blur > 0 && (
        <BlurView intensity={blur} style={StyleSheet.absoluteFill} tint={theme as any} />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
