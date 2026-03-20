import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useCallback, useState } from "react";
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_ROOT, fetchWithTimeout, checkBackendConnection } from "../lib/api";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get("window");
const BASE_URL = API_BASE_URL;

interface LoginFormData {
  emailOrUsername: string;
  password: string;
  mfaCode: string;
  rememberMe: boolean;
}

interface FormErrors {
  emailOrUsername?: string;
  password?: string;
  mfaCode?: string;
}

export default function LoginScreen({ navigation: propNavigation }: { navigation?: any }) {
  const hookNavigation = useNavigation();
  const navigation = propNavigation || hookNavigation;
  const router = useRouter();
  const route = useRoute();
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (route?.params && (route.params as any).registered === 'success') {
        setRegistrationSuccess(true);
      }
      return () => setRegistrationSuccess(false);
    }, [route?.params])
  );

  // Check backend connection when screen is focused (web)
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      setConnectionStatus("Checking...");
      setConnectionError(null);
      checkBackendConnection().then(({ ok, message }) => {
        if (cancelled) return;
        setConnectionStatus(ok ? "Backend connected" : null);
        if (!ok) setConnectionError(`Cannot reach backend: ${message}. Is it running at ${API_ROOT}?`);
      });
      return () => { cancelled = true; setConnectionStatus(null); };
    }, [])
  );

  // Initialize state with type
  const [formData, setFormData] = useState<LoginFormData>({
    emailOrUsername: "",
    password: "",
    mfaCode: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // Validation functions
  const validateEmail = useCallback((email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const currentFormData = formData || {} as LoginFormData;
    const emailOrUsername = currentFormData.emailOrUsername || "";
    const password = currentFormData.password || "";
    const mfaCode = currentFormData.mfaCode || "";
    // Validate emailOrUsername
    if (!emailOrUsername || !emailOrUsername.trim()) {
      newErrors.emailOrUsername = "Email or Username is required";
    }
    // Validate password
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    // Validate MFA code if shown
    if (showMFA) {
      if (!mfaCode) {
        newErrors.mfaCode = "MFA code is required";
      } else if (mfaCode.length !== 6) {
        newErrors.mfaCode = "MFA code must be 6 digits";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, showMFA]);

  const handleInputChange = useCallback((field: keyof LoginFormData, value: string | boolean) => {
    if (!field || typeof field !== 'string') return;
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setErrors(prev => {
      const currentErrors = prev || {};
      if (typeof field === 'string' && field in currentErrors) {
        const newErrors = { ...currentErrors };
        delete newErrors[field as keyof FormErrors];
        return newErrors;
      }
      return currentErrors;
    });
  }, []);

  const handleMFACodeChange = useCallback((value: string) => {
    // Only allow numeric input and limit to 6 characters
    const numericValue = (value || "").replace(/\D/g, "").slice(0, 6);
    handleInputChange("mfaCode", numericValue);
  }, [handleInputChange]);

  const handleLogin = useCallback(async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setConnectionError(null);

    const loginData = {
      emailOrUsername: String(formData.emailOrUsername || "").trim(),
      password: formData.password,
    };
    const loginUrl = `${BASE_URL}/login`;

    try {
      const response = await fetchWithTimeout(
        loginUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginData),
        },
        15000
      );

      const text = await response.text();
      let data: { token?: string; user?: { full_name?: string; user_id?: number; email?: string }; error?: string } = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          if (!response.ok) {
            setConnectionError(`Server error (${response.status}). URL: ${loginUrl}`);
            Alert.alert("Login Failed", `Server returned error (${response.status}).`);
            return;
          }
        }
      }

      if (response.ok && data.token && data.user) {
        await AsyncStorage.setItem("authToken", data.token);
        await AsyncStorage.setItem("currentUser", JSON.stringify(data.user));
        const userName = data.user.full_name || data.user.email || "User";
        if (Platform.OS === "web") {
          router.replace("/CommunityScreen" as any);
        } else {
          Alert.alert("Success", `Welcome back, ${userName}!`, [
            { text: "Continue", onPress: () => router.replace("/CommunityScreen" as any) },
          ]);
        }
        setFormData({ emailOrUsername: "", password: "", mfaCode: "", rememberMe: false });
        setShowMFA(false);
        setErrors({});
      } else {
        const errMsg = data.error || (response.ok ? "Missing token or user." : `Error ${response.status}`);
        setConnectionError(response.ok ? null : errMsg);
        Alert.alert("Login Failed", errMsg);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      const isTimeout = error?.name === "AbortError";
      const isNetwork =
        error?.message?.includes("fetch") ||
        error?.message?.includes("network") ||
        error?.message?.includes("Failed to fetch");
      const msg = isTimeout
        ? "Request timed out. Is the backend running?"
        : isNetwork
          ? `Cannot reach backend at ${loginUrl}. Start the backend and set EXPO_PUBLIC_API_URL in .env if needed.`
          : (error?.message || "Connection error.");
      setConnectionError(msg);
      Alert.alert("Login Failed", msg);
    } finally {
      setIsLoading(false);
    }
  }, [formData, showMFA, validateForm, router]);

  const handleForgotPassword = useCallback(() => {
    Alert.alert(
      "Reset Password",
      "Enter your email address to receive password reset instructions",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send Reset Link",
          onPress: () => {
            // Navigate to forgot password screen or handle reset
            Alert.alert("Reset Link Sent", "Check your email for reset instructions");
          },
        },
      ]
    );
  }, []);

  const toggleRememberMe = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      rememberMe: !(prev?.rememberMe || false),
    }));
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleRegisterNavigation = useCallback(() => {
    router.replace('/RegistrationScreen');
  }, [router]);

  // Safe property access with fallbacks
  const emailOrUsername = formData?.emailOrUsername || "";
  const password = formData?.password || "";
  const mfaCode = formData?.mfaCode || "";
  const rememberMe = formData?.rememberMe || false;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={styles.background}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.loginBox}>
              {connectionStatus && (
                <View style={styles.connectionStatus}>
                  <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
                  <Text style={styles.apiUrlText}>API: {API_ROOT}</Text>
                </View>
              )}
              {connectionError && (
                <View style={styles.connectionError}>
                  <Text style={styles.connectionErrorText}>{connectionError}</Text>
                </View>
              )}
              {registrationSuccess && (
                <View style={{ backgroundColor: '#d0f5e1', padding: 15, borderRadius: 10, marginBottom: 10 }}>
                  <Text style={{ color: '#00894d', textAlign: 'center', fontWeight: 'bold' }}>
                    Registration completed! You can now sign in.
                  </Text>
                </View>
              )}
              <View style={styles.header}>
                <Text style={styles.title}>Welcome Back!</Text>
                <Text style={styles.subtitle}>
                  Sign in to access your communities
                </Text>
              </View>

              <View style={styles.form}>
                {/* Email/Username Input */}
                <View style={styles.inputContainer}>
                  <View style={[
                    styles.inputWrapper,
                    errors?.emailOrUsername && styles.inputError
                  ]}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color="#666"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Email or Username"
                      placeholderTextColor="#999"
                      style={styles.input}
                      value={emailOrUsername}
                      onChangeText={(value) => handleInputChange("emailOrUsername", value)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      accessible={true}
                      accessibilityLabel="Email or Username input field"
                      returnKeyType="next"
                      testID="emailOrUsernameInput"
                    />
                  </View>
                  {errors?.emailOrUsername && (
                    <Text style={styles.errorText}>{errors.emailOrUsername}</Text>
                  )}
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <View style={[
                    styles.inputWrapper,
                    errors?.password && styles.inputError
                  ]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#666"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor="#999"
                      style={styles.input}
                      value={password}
                      onChangeText={(value) => handleInputChange("password", value)}
                      secureTextEntry={!showPassword}
                      accessible={true}
                      accessibilityLabel="Password input field"
                      returnKeyType={showMFA ? "next" : "done"}
                      testID="passwordInput"
                    />
                    <TouchableOpacity
                      onPress={togglePasswordVisibility}
                      style={styles.eyeIcon}
                      accessible={true}
                      accessibilityLabel="Toggle password visibility"
                      testID="togglePasswordButton"
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors?.password && (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  )}
                </View>

                {/* MFA Code Input (conditional) */}
                {showMFA && (
                  <View style={styles.inputContainer}>
                    <View style={[
                      styles.inputWrapper,
                      errors?.mfaCode && styles.inputError
                    ]}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="6-digit MFA Code"
                        placeholderTextColor="#999"
                        style={styles.input}
                        value={mfaCode}
                        onChangeText={handleMFACodeChange}
                        keyboardType="numeric"
                        maxLength={6}
                        accessible={true}
                        accessibilityLabel="Multi-factor authentication code input field"
                        returnKeyType="done"
                        testID="mfaCodeInput"
                      />
                    </View>
                    {errors?.mfaCode && (
                      <Text style={styles.errorText}>{errors.mfaCode}</Text>
                    )}
                  </View>
                )}

                {/* Remember Me Checkbox */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={toggleRememberMe}
                  accessible={true}
                  accessibilityLabel="Remember me checkbox"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  testID="rememberMeCheckbox"
                >
                  <View style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked
                  ]}>
                    {rememberMe && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Remember me</Text>
                </TouchableOpacity>

                {/* Login Button */}
                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  accessible={true}
                  accessibilityLabel="Login button"
                  accessibilityRole="button"
                  testID="loginButton"
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                {/* Forgot Password Link */}
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  style={styles.forgotPasswordContainer}
                  accessible={true}
                  accessibilityLabel="Forgot password link"
                  accessibilityRole="button"
                  testID="forgotPasswordButton"
                >
                  <Text style={styles.forgotPasswordText}>
                    Forgot your password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Register Link */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerPrompt}>Don&apos;t have an account? </Text>
                <TouchableOpacity
                  onPress={handleRegisterNavigation}
                  accessible={true}
                  accessibilityLabel="Navigate to registration screen"
                  accessibilityRole="button"
                  testID="registerButton"
                >
                  <Text style={styles.registerLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  connectionStatus: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  connectionStatusText: {
    color: "#60a5fa",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  apiUrlText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  connectionError: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  connectionErrorText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  loginBox: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingHorizontal: 16,
    height: 56,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  inputIcon: {
    marginRight: 12,
    color: "#64748b",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#f8fafc",
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 5,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 6,
    marginLeft: 6,
    fontWeight: "500",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#6366f1",
    borderRadius: 6,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: "#6366f1",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#cbd5e1",
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: "#6366f1",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: "#475569",
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  forgotPasswordContainer: {
    alignItems: "center",
  },
  forgotPasswordText: {
    color: "#8b5cf6",
    fontSize: 14,
    fontWeight: "600",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  registerPrompt: {
    color: "#94a3b8",
    fontSize: 14,
  },
  registerLink: {
    color: "#8b5cf6",
    fontSize: 15,
    fontWeight: "700",
  },
});