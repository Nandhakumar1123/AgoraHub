import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
    Animated,
    Modal,
    Pressable,
    Dimensions,
} from "react-native";
import axios from "axios";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { 
    User, 
    Mail, 
    Phone, 
    Info, 
    Edit2, 
    Settings, 
    LogOut, 
    Camera, 
    Check, 
    X, 
    ChevronRight,
    AtSign
} from "lucide-react-native";
import { useColorScheme } from "react-native";
import { API_ROOT } from "../lib/api";

const { width } = Dimensions.get("window");
const BASE_URL = API_ROOT;

const ProfileScreen = () => {
    const theme = useColorScheme();
    const isDark = theme === "dark";
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [showSheet, setShowSheet] = useState(false);
    const [errors, setErrors] = useState<any>({});

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    const [formDataState, setFormDataState] = useState({
        full_name: "",
        email: "",
        mobile_number: "",
        bio: "",
        description: "",
    });

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    // ================= LOAD TOKEN =================
    useEffect(() => {
        const loadToken = async () => {
            const storedToken = await AsyncStorage.getItem("authToken");
            if (!storedToken) {
                router.replace("/LoginScreen");
                return;
            }
            setToken(storedToken);
        };
        loadToken();
    }, []);

    // ================= FETCH PROFILE =================
    const fetchProfile = async (authToken: string) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/profile`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            setProfile(res.data);
            if (res.data.profile_image) {
                setImageUri(`${BASE_URL}${res.data.profile_image}`);
            } else {
                setImageUri(null);
            }
            setFormDataState(res.data);
        } catch {
            await AsyncStorage.removeItem("authToken");
            router.replace("/LoginScreen");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchProfile(token);
    }, [token]);

    // ================= EDIT ANIMATION =================
    const toggleEdit = () => {
        setEditing(true);
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0.8,
                duration: 400,
                useNativeDriver: true,
            })
        ]).start();
    };

    const cancelEdit = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            })
        ]).start(() => {
            setEditing(false);
            if (token) fetchProfile(token);
        });
    };

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [100, 0],
    });

    // ================= VALIDATION =================
    const validateForm = () => {
        let newErrors: any = {};
        if (!formDataState.full_name.trim()) newErrors.full_name = "Name is required";
        if (!formDataState.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formDataState.email)) {
            newErrors.email = "Invalid email format";
        }
        if (!formDataState.mobile_number.trim()) {
            newErrors.mobile_number = "Mobile number is required";
        } else if (!/^[0-9]{10}$/.test(formDataState.mobile_number)) {
            newErrors.mobile_number = "Enter valid 10 digit number";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ================= IMAGE =================
    const openGallery = async () => {
        setShowSheet(false);
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled) setImageUri(result.assets[0].uri);
    };

    const openCamera = async () => {
        setShowSheet(false);
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled) setImageUri(result.assets[0].uri);
    };

    const handleRemovePhoto = () => {
        setShowSheet(false);
        setImageUri(null);
    };

    // ================= UPDATE =================
    const handleUpdate = async () => {
        if (!validateForm()) return;
        if (!token) return;
        try {
            await axios.put(`${BASE_URL}/api/profile`, formDataState, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (imageUri && !imageUri.startsWith(BASE_URL)) {
                const formData = new FormData();
                if (Platform.OS === "web") {
                    const response = await fetch(imageUri);
                    const blob = await response.blob();
                    formData.append("image", blob, "profile.jpg");
                } else {
                    formData.append("image", {
                        uri: imageUri,
                        name: "profile.jpg",
                        type: "image/jpeg",
                    } as any);
                }
                await axios.post(`${BASE_URL}/api/profile/upload-image`, formData, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
            Alert.alert("Success", "Profile updated successfully");
            cancelEdit();
        } catch (error) {
            Alert.alert("Error", "Update failed. Please try again.");
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Logout", 
                    style: "destructive", 
                    onPress: async () => {
                        await AsyncStorage.removeItem("authToken");
                        router.replace("/LoginScreen");
                    } 
                }
            ]
        );
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366f1" />
        </View>
    );

    const firstLetter = formDataState.full_name ? formDataState.full_name.charAt(0).toUpperCase() : "?";

    return (
        <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
        >
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                {/* HERO HEADER */}
                <View style={styles.heroSection}>
                    <View style={styles.avatarContainer}>
                        <LinearGradient
                            colors={["#6366f1", "#a855f7", "#ec4899"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.avatarBorder}
                        >
                            <View style={[styles.avatarInner, { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }]}>
                                {imageUri ? (
                                    <Image source={{ uri: imageUri }} style={styles.avatarImage} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Text style={styles.avatarText}>{firstLetter}</Text>
                                    </View>
                                )}
                            </View>
                        </LinearGradient>
                        {editing && (
                            <TouchableOpacity style={styles.editBadge} onPress={() => setShowSheet(true)}>
                                <Camera size={18} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {!editing && (
                        <View style={styles.nameSection}>
                            <Text style={[styles.userName, { color: isDark ? "#f3f4f6" : "#1f2937" }]}>
                                {profile?.full_name}
                            </Text>
                            <View style={styles.emailBadge}>
                                <AtSign size={14} color="#6366f1" style={{ marginRight: 4 }} />
                                <Text style={styles.userEmail}>{profile?.email}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* ACTION BUTTONS */}
                {!editing && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.glassButton} onPress={toggleEdit}>
                            <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.blurBtn}>
                                <Edit2 size={20} color="#6366f1" />
                                <Text style={[styles.btnText, { color: "#6366f1" }]}>Edit Profile</Text>
                            </BlurView>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.glassButton} onPress={() => router.push("/SettingScreen")}>
                            <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.blurBtn}>
                                <Settings size={20} color="#8b5cf6" />
                                <Text style={[styles.btnText, { color: "#8b5cf6" }]}>Settings</Text>
                            </BlurView>
                        </TouchableOpacity>
                    </View>
                )}

                {/* INFO CARDS */}
                {!editing ? (
                    <View style={styles.infoSection}>
                        <GlassCard icon={<Mail size={22} color="#6366f1" />} label="Email Address" value={profile?.email} isDark={isDark} />
                        <GlassCard icon={<Phone size={22} color="#10b981" />} label="Mobile Number" value={profile?.mobile_number} isDark={isDark} />
                        {profile?.bio && (
                            <GlassCard icon={<Info size={22} color="#f59e0b" />} label="Bio" value={profile?.bio} isDark={isDark} />
                        )}
                        {profile?.description && (
                            <GlassCard icon={<User size={22} color="#ec4899" />} label="About" value={profile?.description} isDark={isDark} />
                        )}
                        
                        <TouchableOpacity style={styles.logoutContainer} onPress={handleLogout}>
                            <LinearGradient
                                colors={["#ef4444", "#dc2626"]}
                                style={styles.logoutGradient}
                            >
                                <LogOut size={20} color="white" />
                                <Text style={styles.logoutText}>Log Out Account</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Animated.View style={[styles.formContainer, { transform: [{ translateY }] }]}>
                        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={styles.formBlur}>
                            <Text style={[styles.formTitle, { color: isDark ? "#f3f4f6" : "#1f2937" }]}>Update Your Profile</Text>
                            
                            <InputField 
                                label="Full Name" 
                                icon={<User size={20} color="#6366f1" />} 
                                value={formDataState.full_name} 
                                onChangeText={(val) => setFormDataState({...formDataState, full_name: val})} 
                                error={errors.full_name}
                                isDark={isDark}
                            />

                            <InputField 
                                label="Email Address" 
                                icon={<Mail size={20} color="#6366f1" />} 
                                value={formDataState.email} 
                                onChangeText={(val) => setFormDataState({...formDataState, email: val})} 
                                error={errors.email}
                                isDark={isDark}
                            />

                            <InputField 
                                label="Mobile Number" 
                                icon={<Phone size={20} color="#6366f1" />} 
                                value={formDataState.mobile_number} 
                                onChangeText={(val) => setFormDataState({...formDataState, mobile_number: val})} 
                                error={errors.mobile_number}
                                isDark={isDark}
                                keyboardType="phone-pad"
                            />

                            <InputField 
                                label="Bio" 
                                icon={<Info size={20} color="#6366f1" />} 
                                value={formDataState.bio} 
                                onChangeText={(val) => setFormDataState({...formDataState, bio: val})} 
                                isDark={isDark}
                            />

                            <InputField 
                                label="Description" 
                                icon={<Edit2 size={20} color="#6366f1" />} 
                                value={formDataState.description} 
                                onChangeText={(val) => setFormDataState({...formDataState, description: val})} 
                                multiline
                                isDark={isDark}
                            />

                            <View style={styles.formActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                                    <X size={20} color={isDark ? "#9ca3af" : "#4b5563"} />
                                    <Text style={[styles.cancelBtnText, { color: isDark ? "#9ca3af" : "#4b5563" }]}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
                                    <LinearGradient colors={["#6366f1", "#4f46e5"]} style={styles.saveGradient}>
                                        <Check size={20} color="white" />
                                        <Text style={styles.saveBtnText}>Save Changes</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </BlurView>
                    </Animated.View>
                )}
            </Animated.View>

            {/* IMAGE SELECTOR SHEET */}
            <Modal visible={showSheet} transparent animationType="fade">
                <Pressable style={styles.overlay} onPress={() => setShowSheet(false)}>
                    <View style={styles.sheetContent}>
                        <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.sheetBlur}>
                            <View style={styles.sheetHeader}>
                                <View style={styles.sheetKnob} />
                                <Text style={[styles.sheetTitle, { color: isDark ? "#f3f4f6" : "#1f2937" }]}>Profile Photo</Text>
                            </View>
                            
                            <TouchableOpacity onPress={openCamera} style={styles.sheetItem}>
                                <View style={[styles.iconBox, { backgroundColor: "#e0e7ff" }]}>
                                    <Camera size={22} color="#4338ca" />
                                </View>
                                <Text style={[styles.sheetText, { color: isDark ? "#e5e7eb" : "#374151" }]}>Take New Photo</Text>
                                <ChevronRight size={18} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={openGallery} style={styles.sheetItem}>
                                <View style={[styles.iconBox, { backgroundColor: "#fef3c7" }]}>
                                    <ImagePickerIcon size={22} color="#b45309" />
                                </View>
                                <Text style={[styles.sheetText, { color: isDark ? "#e5e7eb" : "#374151" }]}>Choose from Gallery</Text>
                                <ChevronRight size={18} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleRemovePhoto} style={styles.sheetItem}>
                                <View style={[styles.iconBox, { backgroundColor: "#fee2e2" }]}>
                                    <X size={22} color="#dc2626" />
                                </View>
                                <Text style={[styles.sheetText, { color: "#dc2626" }]}>Remove Current Photo</Text>
                                <ChevronRight size={18} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowSheet(false)} style={styles.sheetCloseBtn}>
                                <Text style={[styles.sheetCloseText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Close</Text>
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                </Pressable>
            </Modal>
        </ScrollView>
    );
};

// --- COMPONENTS ---

const GlassCard = ({ icon, label, value, isDark }: any) => (
    <View style={styles.glassCardWrapper}>
        <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={styles.glassCard}>
            <View style={styles.cardHeader}>
                {icon}
                <Text style={[styles.cardLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>{label}</Text>
            </View>
            <Text style={[styles.cardValue, { color: isDark ? "#f3f4f6" : "#1f2937" }]}>{value || "Not set"}</Text>
        </BlurView>
    </View>
);

const InputField = ({ label, icon, value, onChangeText, error, multiline, keyboardType, isDark }: any) => (
    <View style={styles.inputWrapper}>
        <Text style={[styles.label, { color: isDark ? "#9ca3af" : "#6b7280" }]}>{label}</Text>
        <View style={[
            styles.inputContainer, 
            { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
            error && { borderColor: "#ef4444", borderWidth: 1 }
        ]}>
            <View style={styles.inputIcon}>{icon}</View>
            <TextInput
                style={[
                    styles.input, 
                    { color: isDark ? "#f3f4f6" : "#1f2937" },
                    multiline && { height: 100, textAlignVertical: "top", paddingTop: 12 }
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={`Enter ${label.toLowerCase()}`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                multiline={multiline}
                keyboardType={keyboardType}
            />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

const ImagePickerIcon = ({ size, color }: any) => (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
        <View style={{ width: size - 4, height: size - 4, borderWidth: 2, borderColor: color, borderRadius: 4 }} />
        <View style={{ width: 4, height: 4, backgroundColor: color, borderRadius: 2, position: "absolute", top: 6, right: 6 }} />
    </View>
);

export default ProfileScreen;

const styles = StyleSheet.create({
    scrollContainer: { 
        flexGrow: 1, 
        paddingBottom: 40 
    },
    container: { 
        padding: 20, 
        paddingTop: 40 
    },
    center: { 
        flex: 1, 
        justifyContent: "center", 
        alignItems: "center",
        backgroundColor: "transparent"
    },
    heroSection: {
        alignItems: "center",
        marginBottom: 30,
    },
    avatarContainer: {
        position: "relative",
    },
    avatarBorder: {
        width: 140,
        height: 140,
        borderRadius: 70,
        padding: 4,
        justifyContent: "center",
        alignItems: "center",
        elevation: 10,
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    avatarInner: {
        width: "100%",
        height: "100%",
        borderRadius: 66,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: {
        width: "100%",
        height: "100%",
    },
    avatarPlaceholder: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        fontSize: 50,
        fontWeight: "bold",
        color: "#6366f1",
    },
    editBadge: {
        position: "absolute",
        bottom: 5,
        right: 5,
        backgroundColor: "#6366f1",
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "white",
    },
    nameSection: {
        marginTop: 20,
        alignItems: "center",
    },
    userName: {
        fontSize: 26,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    emailBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        marginTop: 8,
    },
    userEmail: {
        fontSize: 14,
        color: "#6366f1",
        fontWeight: "600",
    },
    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 30,
    },
    glassButton: {
        flex: 1,
        borderRadius: 16,
        overflow: "hidden",
    },
    blurBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        gap: 8,
    },
    btnText: {
        fontWeight: "700",
        fontSize: 15,
    },
    infoSection: {
        gap: 12,
    },
    glassCardWrapper: {
        borderRadius: 20,
        overflow: "hidden",
    },
    glassCard: {
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
    },
    cardLabel: {
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    cardValue: {
        fontSize: 17,
        fontWeight: "700",
        marginLeft: 32,
    },
    logoutContainer: {
        marginTop: 20,
        borderRadius: 16,
        overflow: "hidden",
        elevation: 4,
        shadowColor: "#ef4444",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    logoutGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        gap: 10,
    },
    logoutText: {
        color: "white",
        fontWeight: "800",
        fontSize: 16,
    },
    formContainer: {
        borderRadius: 24,
        overflow: "hidden",
    },
    formBlur: {
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    formTitle: {
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 24,
        textAlign: "center",
    },
    inputWrapper: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        fontWeight: "600",
    },
    errorText: {
        color: "#ef4444",
        fontSize: 12,
        marginTop: 6,
        marginLeft: 12,
        fontWeight: "600",
    },
    formActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 10,
    },
    cancelBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(156, 163, 175, 0.3)",
        gap: 8,
    },
    cancelBtnText: {
        fontWeight: "700",
        fontSize: 16,
    },
    saveBtn: {
        flex: 2,
        borderRadius: 16,
        overflow: "hidden",
    },
    saveGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        gap: 8,
    },
    saveBtnText: {
        color: "white",
        fontWeight: "800",
        fontSize: 16,
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
    },
    sheetContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: "hidden",
    },
    sheetBlur: {
        padding: 24,
    },
    sheetHeader: {
        alignItems: "center",
        marginBottom: 24,
    },
    sheetKnob: {
        width: 40,
        height: 5,
        backgroundColor: "rgba(156, 163, 175, 0.4)",
        borderRadius: 3,
        marginBottom: 16,
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: "800",
    },
    sheetItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(156, 163, 175, 0.1)",
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    sheetText: {
        flex: 1,
        fontSize: 16,
        fontWeight: "700",
    },
    sheetCloseBtn: {
        marginTop: 16,
        alignItems: "center",
        paddingVertical: 8,
    },
    sheetCloseText: {
        fontSize: 16,
        fontWeight: "700",
    },
});



