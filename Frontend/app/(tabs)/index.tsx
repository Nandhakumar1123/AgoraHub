import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Users,
  Zap,
} from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 52) / 2;

type FeatureItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  tint: string;
};

export default function Openpage() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const moveUp = useRef(new Animated.Value(24)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(moveUp, {
        toValue: 0,
        tension: 45,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeIn, moveUp, pulse]);

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  const featuresData: FeatureItem[] = useMemo(
    () => [
      {
        title: "Community Management",
        description: "Create and organize communities with clear roles and access.",
        icon: <Users color="#6366f1" size={24} />,
        tint: "rgba(99, 102, 241, 0.14)",
      },
      {
        title: "Complaints & Petitions",
        description: "Track issues with full visibility and structured progress updates.",
        icon: <AlertCircle color="#10b981" size={24} />,
        tint: "rgba(16, 185, 129, 0.14)",
      },
      {
        title: "Chats & Announcements",
        description: "Share updates instantly and keep members aligned in real time.",
        icon: <MessageSquare color="#f43f5e" size={24} />,
        tint: "rgba(244, 63, 94, 0.14)",
      },
      {
        title: "Events Calendar",
        description: "Plan meetings and activities with reminders and attendance flow.",
        icon: <Calendar color="#f59e0b" size={24} />,
        tint: "rgba(245, 158, 11, 0.16)",
      },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#050816" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={["#050816", "#11183a", "#312e81"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.navbar}>
            <View style={styles.brandWrap}>
              <View style={styles.brandIcon}>
                <Zap color="#c4b5fd" size={16} />
              </View>
              <Text style={styles.brandText}>AgoraHub</Text>
            </View>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/LoginScreen")}
              activeOpacity={0.85}
            >
              <Text style={styles.navButtonText}>Log In</Text>
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              styles.heroContent,
              { opacity: fadeIn, transform: [{ translateY: moveUp }] },
            ]}
          >
            <Text style={styles.heroLabel}>COMMUNITY OPERATING SYSTEM</Text>

            <Animated.Text style={[styles.heroTitle, { opacity: titleOpacity }]}>
              Build a Better
              {"\n"}
              Community Experience
            </Animated.Text>

            <Text style={styles.heroSubtitle}>
              One platform for governance, communication, issue tracking, and
              collaborative growth.
            </Text>

            <View style={styles.heroButtons}>
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push("/RegistrationScreen")}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={["#7c3aed", "#4f46e5"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonInner}
                  >
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                    <ArrowRight color="#fff" size={18} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push("/LoginScreen")}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryButtonText}>Explore Platform</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metricsWrap}>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>24/7</Text>
                <Text style={styles.metricLabel}>Availability</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>100%</Text>
                <Text style={styles.metricLabel}>Transparent Actions</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>Real-time</Text>
                <Text style={styles.metricLabel}>Community Updates</Text>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.contentArea}>
          <View style={styles.sectionHeadingWrap}>
            <Text style={styles.sectionEyebrow}>FEATURES</Text>
            <Text style={styles.sectionTitle}>Everything in one elegant workflow</Text>
            <Text style={styles.sectionText}>
              Built to reduce friction for admins and members with clear actions,
              beautiful layout, and readable communication.
            </Text>
          </View>

          <View style={styles.featureGrid}>
            {featuresData.map((feature, idx) => (
              <Animated.View
                key={feature.title}
                style={[
                  styles.featureCard,
                  {
                    transform: [
                      {
                        translateY: scrollY.interpolate({
                          inputRange: [0, 220 + idx * 35],
                          outputRange: [24, 0],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                    opacity: scrollY.interpolate({
                      inputRange: [0, 200 + idx * 20],
                      outputRange: [0.35, 1],
                      extrapolate: "clamp",
                    }),
                  },
                ]}
              >
                <View style={[styles.featureIcon, { backgroundColor: feature.tint }]}>
                  {feature.icon}
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </Animated.View>
            ))}
          </View>

          <LinearGradient
            colors={["#ffffff", "#f8faff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aboutCard}
          >
            <Text style={styles.aboutEyebrow}>ABOUT AGORAHUB</Text>
            <Text style={styles.aboutTitle}>Designed for trust, clarity, and speed</Text>
            <Text style={styles.aboutBody}>
              AgoraHub helps communities run smoother through transparent records,
              responsive communication, and intelligent collaboration tools.
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerTop}>
            <Text style={styles.footerBrand}>AgoraHub</Text>
            <Text style={styles.footerTagline}>
              Turning complex governance into a simple daily experience.
            </Text>
          </View>

          <View style={styles.footerBlock}>
            <Text style={styles.footerHeading}>Contact</Text>
            <View style={styles.row}>
              <Phone color="#94a3b8" size={16} />
              <Text style={styles.rowText}>+1 (555) 123-4567</Text>
            </View>
            <View style={styles.row}>
              <Mail color="#94a3b8" size={16} />
              <Text style={styles.rowText}>contact@agorahub.io</Text>
            </View>
          </View>

          <View style={styles.footerBlock}>
            <Text style={styles.footerHeading}>Social</Text>
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome name="twitter" color="#fff" size={18} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome name="facebook" color="#fff" size={18} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialIcon}>
                <FontAwesome name="instagram" color="#fff" size={18} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerLine} />
          <Text style={styles.copyText}>
            © {new Date().getFullYear()} AgoraHub. All rights reserved.
          </Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050816",
  },
  scrollContent: {
    paddingBottom: 24,
    backgroundColor: "#eef2ff",
  },
  hero: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 42,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: "hidden",
  },
  heroGlowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -90,
    right: -40,
    backgroundColor: "rgba(129, 140, 248, 0.28)",
  },
  heroGlowTwo: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    bottom: -70,
    left: -40,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
  },
  navbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  brandText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  navButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroContent: {
    alignItems: "center",
  },
  heroLabel: {
    color: "#c4b5fd",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "800",
    marginBottom: 12,
  },
  heroTitle: {
    color: "#fff",
    textAlign: "center",
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    color: "rgba(226,232,240,0.95)",
    textAlign: "center",
    marginTop: 14,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 350,
  },
  heroButtons: {
    marginTop: 28,
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonInner: {
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  metricsWrap: {
    marginTop: 22,
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  metricPill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
  },
  metricValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  metricLabel: {
    color: "#cbd5e1",
    marginTop: 2,
    fontSize: 11,
    textAlign: "center",
  },
  contentArea: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 14,
  },
  sectionHeadingWrap: {
    marginBottom: 18,
  },
  sectionEyebrow: {
    color: "#4f46e5",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    fontWeight: "800",
  },
  sectionText: {
    color: "#475569",
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  featureTitle: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    marginBottom: 7,
    letterSpacing: -0.3,
  },
  featureDescription: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
  },
  aboutCard: {
    marginTop: 8,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  aboutEyebrow: {
    color: "#6366f1",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  aboutTitle: {
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  aboutBody: {
    marginTop: 10,
    color: "#334155",
    fontSize: 15,
    lineHeight: 24,
  },
  footer: {
    marginTop: 8,
    backgroundColor: "#050816",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
  },
  footerTop: {
    marginBottom: 22,
  },
  footerBrand: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  footerTagline: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  footerBlock: {
    marginBottom: 18,
  },
  footerHeading: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
    gap: 9,
  },
  rowText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#172036",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  footerLine: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    marginTop: 6,
    marginBottom: 14,
  },
  copyText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    letterSpacing: 0.4,
  },
});