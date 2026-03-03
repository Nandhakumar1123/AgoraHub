import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../lib/api";

const { width, height } = Dimensions.get("window");
const BASE_URL = API_BASE_URL;


const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Chinese", value: "zh" },
  { label: "Japanese", value: "ja" },
  { label: "Arabic", value: "ar" },
  { label: "Hindi", value: "hi" },
];

type FormErrors = {
  fullName?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  password?: string | null;
  confirmPassword?: string | null;
  preferredLanguage?: string | null;
  voiceSupport?: string | null;
  acceptTerms?: string | null;
  profileType?: string | null;
  dataStorage?: string | null;
  participation?: string | null;
};

export default function RegistrationScreen({ navigation: propNavigation }: { navigation?: any }) {
  const hookNavigation = useNavigation();
  const navigation = propNavigation || hookNavigation;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
    preferredLanguage: "en",
    voiceSupport: false,
    acceptTerms: false,
  });

  const [privacyPreferences, setPrivacyPreferences] = useState({
    profileType: "transparent", // transparent or opaque
    dataStorage: "encrypted", // encrypted or simple
    participation: "non-anonymous", // anonymous or non-anonymous
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: "",
  });
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateMobile = (mobile: string) => {
    const mobileRegex = /^\+?[1-9]\d{1,14}$/;
    return mobileRegex.test(mobile);
  };

  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    let feedback = "";

    if (password.length === 0) {
      return { score: 0, feedback: "" };
    }

    if (password.length < 6) {
      return { score: 1, feedback: "Too short" };
    }

    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    switch (score) {
      case 1:
      case 2:
        feedback = "Weak";
        break;
      case 3:
        feedback = "Fair";
        break;
      case 4:
        feedback = "Good";
        break;
      case 5:
        feedback = "Strong";
        break;
      default:
        feedback = "Very Weak";
    }

    return { score, feedback };
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    const pwdStrength = calculatePasswordStrength(formData.password);

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.mobileNumber && !validateMobile(formData.mobileNumber)) {
      newErrors.mobileNumber = "Please enter a valid mobile number";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (pwdStrength.score < 2) {
      newErrors.password = "Please choose a stronger password (mix of letters, numbers)";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "You must accept the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Calculate password strength for password field
    if (field === "password") {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear error when user starts typing
    if (errors && errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const handlePrivacyChange = (field: keyof typeof privacyPreferences, value: any) => {
    setPrivacyPreferences((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleVoiceSupport = () => {
    setFormData((prev) => ({
      ...prev,
      voiceSupport: !prev.voiceSupport,
    }));
  };

  const toggleAcceptTerms = () => {
    setFormData((prev) => ({
      ...prev,
      acceptTerms: !prev.acceptTerms,
    }));

    if (errors && errors.acceptTerms) {
      setErrors((prev) => ({
        ...prev,
        acceptTerms: null,
      }));
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const profileType = privacyPreferences.profileType === "opaque" ? "private" : "transparent";
      const registrationData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        mobileNumber: formData.mobileNumber.trim() || undefined,
        password: formData.password,
        preferredLanguage: formData.preferredLanguage,
        voiceSupport: formData.voiceSupport,
        acceptTerms: formData.acceptTerms,
        profileType,
        privacyPreferences,
      };

      const response = await fetch(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });

      let data: { token?: string; user?: { full_name?: string }; error?: string } = {};
      try {
        const text = await response.text();
        if (text && text.trim()) data = JSON.parse(text);
      } catch (_) {
        if (!response.ok) {
          Alert.alert("Registration Failed", `Server error (${response.status}). Check API URL.`);
          return;
        }
      }

      if (response.ok && data.token && data.user) {
        await AsyncStorage.setItem("authToken", data.token);
        Alert.alert(
          "Account Created!",
          `Account created for ${data.user.full_name || "you"}! You can sign in now.`,
          [
            {
              text: "OK",
              onPress: () => router.replace({ pathname: "/LoginScreen", params: { registered: "success" } } as any),
            },
          ]
        );
      } else {
        Alert.alert("Registration Failed", data.error || "Unknown error");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      const msg =
        error?.message?.includes("fetch") || error?.message?.includes("network")
          ? "Could not reach server. Ensure backend is running and API URL is correct (check .env EXPO_PUBLIC_API_URL)."
          : "Could not connect to server";
      Alert.alert("Registration Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const showTermsAndConditions = () => {
    Alert.alert(
      "Terms & Conditions",
      "This would typically open the full terms and conditions document. In a real app, this would navigate to a detailed terms screen or web view.",
      [{ text: "Close" }]
    );
  };

  const showPrivacyPolicy = () => {
    Alert.alert(
      "Privacy Policy",
      "This would typically open the full privacy policy document. In a real app, this would navigate to a detailed privacy policy screen or web view.",
      [{ text: "Close" }]
    );
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength.score) {
      case 0:
      case 1:
        return "#e74c3c";
      case 2:
        return "#f39c12";
      case 3:
        return "#f1c40f";
      case 4:
      case 5:
        return "#27ae60";
      default:
        return "#bdc3c7";
    }
  };

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ImageBackground
          source={{ uri: "https://i.ibb.co/6vD7n3K/bg.jpg" }}
          style={styles.background}
          resizeMode="cover"
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
              <View style={styles.registerBox}>
                <View style={styles.header}>
                  <Text style={styles.title}>Join Our Community</Text>
                  <Text style={styles.subtitle}>
                    Create your account to get started
                  </Text>
                </View>

                <View style={styles.form}>
                  {/* Full Name Input */}
                  <View style={styles.inputContainer}>
                    <View
                      style={[
                        styles.inputWrapper,
                        errors.fullName && styles.inputError,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Full Name"
                        placeholderTextColor="#999"
                        style={styles.input}
                        value={formData.fullName}
                        onChangeText={(value) =>
                          handleInputChange("fullName", value)
                        }
                        autoCapitalize="words"
                        accessible={true}
                        accessibilityLabel="Full name input field"
                      />
                    </View>
                    {errors.fullName && (
                      <Text style={styles.errorText}>{errors.fullName}</Text>
                    )}
                  </View>

                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <View
                      style={[styles.inputWrapper, errors.email && styles.inputError]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Email Address"
                        placeholderTextColor="#999"
                        style={styles.input}
                        value={formData.email}
                        onChangeText={(value) =>
                          handleInputChange("email", value.toLowerCase())
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        accessible={true}
                        accessibilityLabel="Email address input field"
                      />
                    </View>
                    {errors.email && (
                      <Text style={styles.errorText}>{errors.email}</Text>
                    )}
                  </View>

                  {/* Mobile Number Input */} 
                  <View style={styles.inputContainer}>
                    <View
                      style={[
                        styles.inputWrapper,
                        errors.mobileNumber && styles.inputError,
                      ]}
                    >
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Mobile Number (Optional)"
                        placeholderTextColor="#999"
                        style={styles.input}
                        value={formData.mobileNumber}
                        onChangeText={(value) =>
                          handleInputChange("mobileNumber", value)
                        }
                        keyboardType="phone-pad"
                        accessible={true}
                        accessibilityLabel="Mobile number input field"
                      />
                    </View>
                    {errors.mobileNumber && (
                      <Text style={styles.errorText}>{errors.mobileNumber}</Text>
                    )}
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputContainer}>
                    <View
                      style={[styles.inputWrapper, errors.password && styles.inputError]}
                    >
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
                        value={formData.password}
                        onChangeText={(value) => handleInputChange("password", value)}
                        secureTextEntry={!showPassword}
                        accessible={true}
                        accessibilityLabel="Password input field"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                        accessible={true}
                        accessibilityLabel="Toggle password visibility"
                      >
                        <Ionicons
                          name={showPassword ? "eye-outline" : "eye-off-outline"}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                    {formData.password.length > 0 && (
                      <View style={styles.passwordStrength}>
                        <View style={styles.strengthBar}>
                          <View
                            style={[
                              styles.strengthFill,
                              {
                                width: `${(passwordStrength.score / 5) * 100}%`,
                                backgroundColor: getPasswordStrengthColor(),
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.strengthText,
                            { color: getPasswordStrengthColor() },
                          ]}
                        >
                          {passwordStrength.feedback}
                        </Text>
                      </View>
                    )}
                    {errors.password && (
                      <Text style={styles.errorText}>{errors.password}</Text>
                    )}
                  </View>

                  {/* Confirm Password Input */}
                  <View style={styles.inputContainer}>
                    <View
                      style={[
                        styles.inputWrapper,
                        errors.confirmPassword && styles.inputError,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Confirm Password"
                        placeholderTextColor="#999"
                        style={styles.input}
                        value={formData.confirmPassword}
                        onChangeText={(value) =>
                          handleInputChange("confirmPassword", value)
                        }
                        secureTextEntry={!showConfirmPassword}
                        accessible={true}
                        accessibilityLabel="Confirm password input field"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeIcon}
                        accessible={true}
                        accessibilityLabel="Toggle confirm password visibility"
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.confirmPassword && (
                      <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                    )}
                  </View>

                  {/* Profile Type Selection (Transparent / Opaque) */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Profile Type</Text>
                    <View style={styles.profileTypeContainer}>
                      <TouchableOpacity
                        style={[
                          styles.profileTypeButton,
                          privacyPreferences.profileType === "transparent" &&
                            styles.profileTypeActive,
                        ]}
                        onPress={() => handlePrivacyChange("profileType", "transparent")}
                        accessible={true}
                        accessibilityLabel="Select transparent profile type"
                      >
                        <Ionicons
                          name="eye-outline"
                          size={18}
                          color={
                            privacyPreferences.profileType === "transparent"
                              ? "#fff"
                              : "#666"
                          }
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.profileTypeText,
                            privacyPreferences.profileType === "transparent" &&
                              styles.profileTypeTextActive,
                          ]}
                        >
                          Transparent
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.profileTypeButton,
                          privacyPreferences.profileType === "opaque" &&
                            styles.profileTypeActive,
                        ]}
                        onPress={() => handlePrivacyChange("profileType", "opaque")}
                        accessible={true}
                        accessibilityLabel="Select opaque profile type"
                      >
                        <Ionicons
                          name="eye-off-outline"
                          size={18}
                          color={
                            privacyPreferences.profileType === "opaque" ? "#fff" : "#666"
                          }
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.profileTypeText,
                            privacyPreferences.profileType === "opaque" &&
                              styles.profileTypeTextActive,
                          ]}
                        >
                          Opaque
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Language Preference */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Preferred Language</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowLanguagePicker(true)}
                      accessible={true}
                      accessibilityLabel="Language selection button"
                    >
                      <Ionicons
                        name="language-outline"
                        size={20}
                        color="#666"
                        style={styles.inputIcon}
                      />
                      <Text style={styles.pickerText}>
                        {LANGUAGES.find(
                          (lang) => lang.value === formData.preferredLanguage
                        )?.label || "Select Language"}
                      </Text>
                      <Ionicons name="chevron-down-outline" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Voice Support Toggle */} 
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={toggleVoiceSupport}
                    accessible={true}
                    accessibilityLabel="Voice support toggle"
                  >
                    <View style={styles.toggleContent}>
                      <Ionicons
                        name="mic-outline"
                        size={20}
                        color="#666"
                        style={styles.toggleIcon}
                      />
                      <Text style={styles.toggleLabel}>Enable Voice Support</Text>
                    </View>
                    <View
                      style={[
                        styles.toggle,
                        formData.voiceSupport && styles.toggleActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          formData.voiceSupport && styles.toggleThumbActive,
                        ]}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Terms and Conditions */}
                  <View style={styles.termsContainer}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={toggleAcceptTerms}
                      accessible={true}
                      accessibilityLabel="Accept terms and conditions checkbox"
                    >
                      <View
                        style={[
                          styles.checkbox,
                          formData.acceptTerms && styles.checkboxChecked,
                          errors.acceptTerms && styles.checkboxError,
                        ]}
                      >
                        {formData.acceptTerms && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                      <View style={styles.termsText}>
                        <Text style={styles.termsLabel}>I agree to the </Text>
                        <TouchableOpacity onPress={showTermsAndConditions}>
                          <Text style={styles.termsLink}>Terms & Conditions</Text>
                        </TouchableOpacity>
                        <Text style={styles.termsLabel}> and </Text>
                        <TouchableOpacity onPress={showPrivacyPolicy}>
                          <Text style={styles.termsLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                    {errors.acceptTerms && (
                      <Text style={styles.errorText}>{errors.acceptTerms}</Text>
                    )}
                  </View>

                  {/* Register Button */}
                  <TouchableOpacity
                    style={[styles.registerButton, isLoading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={isLoading}
                    accessible={true}
                    accessibilityLabel="Create account button"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.registerButtonText}>Create Account</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Login Link */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginPrompt}>Already have an account? </Text>
                  <TouchableOpacity
                    onPress={() => {
                      router.replace('/LoginScreen');
                    }}
                    accessible={true}
                    accessibilityLabel="Navigate to login screen"
                  >
                    <Text style={styles.loginLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Language Picker Modal */}
          <Modal
            visible={showLanguagePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLanguagePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Language</Text>
                  <TouchableOpacity
                    onPress={() => setShowLanguagePicker(false)}
                    style={styles.modalClose}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.languageList}>
                  {LANGUAGES.map((language) => (
                    <TouchableOpacity
                      key={language.value}
                      style={[
                        styles.languageOption,
                        formData.preferredLanguage === language.value &&
                          styles.languageSelected,
                      ]}
                      onPress={() => {
                        handleInputChange("preferredLanguage", language.value);
                        setShowLanguagePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.languageText,
                          formData.preferredLanguage === language.value &&
                            styles.languageTextSelected,
                        ]}
                      >
                        {language.label}
                      </Text>
                      {formData.preferredLanguage === language.value && (
                        <Ionicons name="checkmark" size={20} color="#27ae60" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </ImageBackground>
      </View>
    </SafeAreaProvider>
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
    paddingVertical: 40,
  },
  registerBox: {
    width: width * 0.9,
    maxWidth: 420,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    marginTop: 6,
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#2c3e50",
    marginBottom: 8,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e1e8ed",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    height: 55,
  },
  inputError: {
    borderColor: "#e74c3c",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#2c3e50",
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 5,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  passwordStrength: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: "#ecf0f1",
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  sectionContainer: {
    marginBottom: 25,
    padding: 20,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 15,
  },
  preferenceContainer: {
    marginBottom: 20,
  },
  preferenceLabel: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 10,
    fontWeight: "500",
  },
  radioGroup: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 10,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#3498db",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: {
    borderColor: "#27ae60",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#27ae60",
  },
  radioText: {
    fontSize: 14,
    color: "#495057",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e1e8ed",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    height: 55,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    color: "#2c3e50",
  },
  // Profile type styles
  profileTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  profileTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e8ed",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    marginRight: 10,
  },
  profileTypeActive: {
    backgroundColor: "#27ae60",
    borderColor: "#27ae60",
  },
  profileTypeText: {
    fontSize: 15,
    color: "#2c3e50",
  },
  profileTypeTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  // Toggle styles
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 5,
    marginBottom: 6,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleIcon: {
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: "#2c3e50",
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#bdc3c7",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: "#27ae60",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    alignSelf: "flex-start",
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  termsContainer: {
    marginBottom: 18,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#3498db",
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#3498db",
  },
  checkboxError: {
    borderColor: "#e74c3c",
  },
  termsText: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  termsLabel: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 14,
    color: "#3498db",
    fontWeight: "500",
    lineHeight: 20,
  },
  registerButton: {
    backgroundColor: "#27ae60",
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    marginTop: 6,
  },
  buttonDisabled: {
    backgroundColor: "#95a5a6",
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#ecf0f1",
    marginTop: 8,
  },
  loginPrompt: {
    color: "#7f8c8d",
    fontSize: 14,
  },
  loginLink: {
    color: "#3498db",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
  },
  modalClose: {
    padding: 5,
  },
  languageList: {
    maxHeight: height * 0.5,
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f4",
  },
  languageSelected: {
    backgroundColor: "#f8f9fa",
  },
  languageText: {
    fontSize: 16,
    color: "#2c3e50",
  },
  languageTextSelected: {
    color: "#27ae60",
    fontWeight: "500",
  },
});
