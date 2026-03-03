import { View, Text, StyleSheet } from 'react-native';

export default function ExploreTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Explore Tab</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
