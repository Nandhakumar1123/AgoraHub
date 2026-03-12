import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, Sparkles, ArrowRight, Zap, Shield, Component } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

const Openpage = () => {
  const navigation = useNavigation<any>();
  const [hovered, setHovered] = useState<number | null>(null);

  const posts = [
    {
      id: 1,
      title: "Welcome to the Future",
      content: "Experience a seamless, AI-driven community collaboration.",
      author: "Admin",
      date: "2025-09-27",
      icon: <Sparkles color="#8b5cf6" size={24} />
    },
    {
      id: 2,
      title: "Lightning Fast UX",
      content: "Optmized performance with modern tooling and design.",
      author: "Jane",
      date: "2025-09-26",
      icon: <Zap color="#f59e0b" size={24} />
    },
    {
      id: 3,
      title: "Secure & Private",
      content: "Your data is protected by state-of-the-art security.",
      author: "John",
      date: "2025-09-25",
      icon: <Shield color="#10b981" size={24} />
    },
  ];

  const handleLogin = () => {
    navigation.navigate("LoginScreen");
  };

  const handleRegister = () => {
    navigation.navigate("RegistrationScreen");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Component color="#6366f1" size={28} />
            <Text style={styles.logo}>NexHub</Text>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.badgeContainer}>
            <Sparkles color="#8b5cf6" size={16} />
            <Text style={styles.badgeText}>Next-Gen Community Platform</Text>
          </View>
          <Text style={styles.heroTitle}>
            Connect, Share, and <Text style={styles.textHighlight}>Grow</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Join an intelligent, AI-powered community to exchange ideas, collaborate seamlessly, and participate in global events.
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.8}>
              <Text style={styles.loginBtnText}>Start Journey</Text>
              <ArrowRight width={20} height={20} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} activeOpacity={0.8}>
              <Text style={styles.registerBtnText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts Section */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>Why Choose Us</Text>
          <View style={styles.postsGrid}>
            {posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={[
                  styles.postCard,
                  hovered === post.id && styles.postHovered,
                ]}
                onPress={() => console.log(`Opening post ${post.title}`)}
                onPressIn={() => setHovered(post.id)}
                onPressOut={() => setHovered(null)}
                activeOpacity={0.9}
              >
                <View style={styles.postIconContainer}>
                  {post.icon}
                </View>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postContent}>{post.content}</Text>
                <View style={styles.postFooter}>
                  <Text style={styles.postMeta}>By {post.author}</Text>
                  <Text style={styles.postMeta}>{post.date}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 NexHub. Empowering communities.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a", // Deep slate background for AI feel
  },
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "transparent",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  hero: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  badgeText: {
    color: "#a78bfa",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "900",
    color: "#f8fafc",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 50,
  },
  textHighlight: {
    color: "#6366f1", // Indigo pop
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 28,
    maxWidth: width * 0.9,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    paddingHorizontal: 10,
  },
  loginBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1", // primary vibrant color
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  registerBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 16,
    borderRadius: 16,
  },
  registerBtnText: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 16,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 24,
    marginTop: 10,
  },
  postsGrid: {
    gap: 16,
  },
  postCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)", // glassmorphism effect
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  postHovered: {
    transform: [{ scale: 1.02 }],
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  postIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 10,
  },
  postContent: {
    color: "#94a3b8",
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    paddingTop: 16,
  },
  postMeta: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  footer: {
    padding: 24,
    alignItems: "center",
    marginTop: 40,
  },
  footerText: {
    color: "#475569",
    fontSize: 14,
  },
});

export default Openpage;
