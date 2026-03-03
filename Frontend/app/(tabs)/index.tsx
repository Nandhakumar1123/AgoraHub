import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { User, ChevronDown, Mail } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";


const Openpage = () => {
  const router = useRouter();
  const [hovered, setHovered] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const posts = [
    { id: 1, title: "Welcome to Our Community!", content: "Let's collaborate and share ideas.", author: "Admin", date: "2025-09-27" },
    { id: 2, title: "React Tips", content: "Share your favorite React tips and tricks.", author: "Jane", date: "2025-09-26" },
    { id: 3, title: "Upcoming Events", content: "Join our upcoming coding events and hackathons.", author: "John", date: "2025-09-25" },
  ];


  const handleJoinNow = () => router.push("/LoginScreen");


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>CommunityHub</Text>
          <View style={styles.nav}>
            <Text style={styles.navItem}>Home</Text>
            <Text style={styles.navItem}>Community</Text>
            <Text style={styles.navItem}>Events</Text>
            <Text style={styles.navItem}>About</Text>
          </View>
        </View>


        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Connect, Share, and Grow</Text>
          <Text style={styles.heroSubtitle}>Join our community to exchange ideas, collaborate, and participate in events.</Text>
          <TouchableOpacity style={styles.joinButton} onPress={handleJoinNow}>
            <Text style={styles.joinButtonText}>Join Now</Text>
            <User width={20} height={20} color="#4f46e5" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>


        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 CommunityHub. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 16, backgroundColor: "#4f46e5" },
  logo: { fontSize: 24, fontWeight: "bold", color: "white" },
  nav: { flexDirection: "row", gap: 16 },
  navItem: { color: "white", marginHorizontal: 8 },
  hero: { padding: 24, alignItems: "center", backgroundColor: "#6366f1" },
  heroTitle: { fontSize: 28, fontWeight: "bold", color: "white", marginBottom: 8 },
  heroSubtitle: { fontSize: 16, color: "white", textAlign: "center", marginBottom: 16 },
  joinButton: { flexDirection: "row", alignItems: "center", backgroundColor: "white", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30 },
  joinButtonText: { color: "#4f46e5", fontWeight: "bold" },
  sectionTitle: { fontSize: 22, textAlign: "center", marginVertical: 16, fontWeight: "bold", color: "#1f2937" },
  posts: { padding: 16 },
  postCard: { backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  postHovered: { transform: [{ scale: 1.02 }], shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6 },
  postTitle: { fontSize: 18, fontWeight: "bold", color: "#4f46e5", marginBottom: 8 },
  postContent: { color: "#374151", marginBottom: 8 },
  postFooter: { flexDirection: "row", justifyContent: "space-between" },
  postMeta: { fontSize: 12, color: "#9ca3af" },
  footer: { backgroundColor: "#4f46e5", padding: 16, alignItems: "center" },
  footerText: { color: "white" },
});


export default Openpage;


