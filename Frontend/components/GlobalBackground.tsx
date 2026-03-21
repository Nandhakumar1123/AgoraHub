import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallpaper } from '../context/WallpaperContext';

const { width, height } = Dimensions.get('window');

interface GlobalBackgroundProps {
  children: React.ReactNode;
}

export const GlobalBackground: React.FC<GlobalBackgroundProps> = ({ children }) => {
  const { wallpaper, blur } = useWallpaper();

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

  return (
    <View style={styles.container}>
      {renderBackground()}
      {wallpaper && blur > 0 && (
        <BlurView intensity={blur} style={StyleSheet.absoluteFill} tint="dark" />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Fallback color
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
