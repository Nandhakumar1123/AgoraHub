import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { User, ChevronRight, Mail, Users, MessageSquare, Calendar, Info, ArrowRight, Zap, Target, Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmallScreen = SCREEN_WIDTH < 380;

const Openpage = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const handleJoinNow = () => router.push("/LoginScreen");

  const cards = [
    { id: 1, title: "Collaborate", icon: <Users color="#6366f1" size={24} />, desc: "Connect with like-minded individuals in your community." },
    { id: 2, title: "Communicate", icon: <MessageSquare color="#f43f5e" size={24} />, desc: "Share ideas and engage in meaningful discussions." },
    { id: 3, title: "Celebrate", icon: <Calendar color="#10b981" size={24} />, desc: "Participate in local events and hackathons." },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4f46e5', '#818cf8', '#f3f4f6']}
        style={[styles.backgroundGradient, { paddingTop: insets.top }]}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Enhanced Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Community<Text style={styles.logoSpan}>Hub</Text></Text>
            <TouchableOpacity style={styles.loginBtnSmall} onPress={() => router.push("/LoginScreen")}>
              <Text style={styles.loginBtnTextSmall}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Premium Hero Section */}
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Zap size={14} color="#4f46e5" fill="#4f46e5" />
              <Text style={styles.heroBadgeText}>Powering Local Communities</Text>
            </View>
            <Text style={styles.heroTitle}>Connect, Share,{"\n"}and <Text style={styles.heroHighlight}>Grow</Text></Text>
            <Text style={styles.heroSubtitle}>
              The ultimate platform to exchange ideas, collaborate on projects, and participate in impactful events.
            </Text>
            
            <TouchableOpacity style={styles.joinButton} onPress={handleJoinNow} activeOpacity={0.8}>
                <LinearGradient
                    colors={['#4f46e5', '#6366f1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.joinButtonGradient}
                >
                    <Text style={styles.joinButtonText}>Get Started Now</Text>
                    <ArrowRight width={20} height={20} color="white" style={{ marginLeft: 8 }} />
                </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Features / Cards Section */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionHeading}>Why Join Us?</Text>
            <View style={styles.cardsContainer}>
              {cards.map((card) => (
                <View key={card.id} style={styles.card}>
                  <View style={styles.cardIconWrapper}>{card.icon}</View>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.desc}</Text>
                  <TouchableOpacity style={styles.cardLink}>
                    <Text style={styles.cardLinkText}>Learn More</Text>
                    <ChevronRight size={14} color="#6366f1" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Glassmorphism Stats Section */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>10k+</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.statNumber}>500+</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>50+</Text>
              <Text style={styles.statLabel}>Hubs</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 CommunityHub</Text>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>Privacy</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerLink}>Terms</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  backgroundGradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    height: 60,
    marginBottom: 20,
  },
  logo: { fontSize: 22, fontWeight: "900", color: "white", letterSpacing: -0.5 },
  logoSpan: { color: "#e0e7ff", fontWeight: "400" },
  loginBtnSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  loginBtnTextSmall: { color: "white", fontWeight: "600", fontSize: 14 },

  hero: { 
    paddingVertical: 30, 
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 50,
    marginBottom: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heroBadgeText: { fontSize: 12, color: "#4f46e5", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTitle: { 
    fontSize: isSmallScreen ? 34 : 42, 
    fontWeight: "800", 
    color: "white", 
    textAlign: "center", 
    lineHeight: isSmallScreen ? 42 : 50,
    marginBottom: 16,
  },
  heroHighlight: { color: "#312e81" },
  heroSubtitle: { 
    fontSize: 16, 
    color: "#e0e7ff", 
    textAlign: "center", 
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  joinButton: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  joinButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  joinButtonText: { color: "white", fontSize: 18, fontWeight: "800" },

  featuresSection: { marginTop: 40 },
  sectionHeading: { fontSize: 24, fontWeight: "800", color: "#1f2937", marginBottom: 24, textAlign: "left" },
  cardsContainer: { gap: 16 },
  card: { 
    backgroundColor: "white", 
    borderRadius: 24, 
    padding: 24, 
    shadowColor: "#000", 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cardIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 8 },
  cardDesc: { fontSize: 14, color: "#6b7280", lineHeight: 20, marginBottom: 16 },
  cardLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardLinkText: { fontSize: 14, color: "#6366f1", fontWeight: "700" },

  statsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 24,
    marginTop: 40,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  statBox: { flex: 1, alignItems: "center" },
  statBoxBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  statNumber: { fontSize: 20, fontWeight: "800", color: "#4f46e5" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: "600" },

  footer: { 
    marginTop: 60, 
    paddingVertical: 24, 
    borderTopWidth: 1, 
    borderTopColor: "rgba(0,0,0,0.05)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  footerLinks: { flexDirection: "row", gap: 8, alignItems: "center" },
  footerLink: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  footerDot: { color: "#d1d5db", fontSize: 10 },
});

export default Openpage;


