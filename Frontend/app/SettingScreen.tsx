import React, { useState, useEffect, useRef, useContext } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    Animated,
    ScrollView,
    ActivityIndicator,
    Platform,
    Modal,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import axios from "axios";
import { AppContext } from "./_layout"; // adjust if needed


/* ================= BASE URL ================= */


const BASE_URL =
    Platform.OS === "web"
        ? "http://localhost:3002"
        : "http://10.14.105.170:3002";


const SettingScreen = () => {
    const router = useRouter();
    const { theme, toggleTheme } = useContext(AppContext);


    const isDark = theme === "dark";


    const [notifications, setNotifications] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);


    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);


    /* ================= LOGOUT ================= */


    const handleLogout = async () => {
        await AsyncStorage.removeItem("authToken");
        router.replace("/LoginScreen");
    };


    /* ================= DELETE ACCOUNT ================= */


    const handleDeleteAccount = async () => {
        try {
            setDeleting(true);
            setConfirmVisible(false);


            const token = await AsyncStorage.getItem("authToken");


            await axios.delete(`${BASE_URL}/api/delete-account`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });


            await AsyncStorage.removeItem("authToken");


            router.replace("/LoginScreen");
        } catch (error) {
            console.log(error);
            alert("Failed to delete account");
        } finally {
            setDeleting(false);
        }
    };


    const themeStyles = isDark ? darkTheme : lightTheme;


    return (
        <View style={[styles.container, themeStyles.container]}>
            <LinearGradient
                colors={isDark ? ["#1f2937", "#111827"] : ["#6366f1", "#8b5cf6"]}
                style={styles.header}
            >
                <Text style={styles.headerText}>Settings</Text>
            </LinearGradient>


            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Animated.View
                    style={{
                        opacity: fadeAnim,
                        transform: [{ translateY }],
                    }}
                >
                    {/* GENERAL */}
                    <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>
                        General
                    </Text>


                    <View style={[styles.card, themeStyles.card]}>
                        <View style={styles.row}>
                            <Text style={[styles.optionText, themeStyles.text]}>
                                Dark Mode
                            </Text>
                            <Switch value={isDark} onValueChange={toggleTheme} />
                        </View>
                        <View style={styles.row}>
                            <Text style={[styles.optionText, themeStyles.text]}>
                                Notifications
                            </Text>
                            <Switch
                                value={notifications}
                                onValueChange={() => setNotifications(!notifications)}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => router.push("/wallpaper")}
                        >
                            <Text style={[styles.optionText, themeStyles.text]}>
                                Wallpaper
                            </Text>
                        </TouchableOpacity>



                    </View>


                    {/* ACCOUNT */}
                    <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>
                        Account
                    </Text>


                    <View style={[styles.card, themeStyles.card]}>
                        <TouchableOpacity
                            style={styles.option}
                            onPress={() => router.push("/ChangePasswordScreen")}
                        >
                            <Text style={[styles.optionText, themeStyles.text]}>
                                Change Password
                            </Text>
                        </TouchableOpacity>


                        <TouchableOpacity
                            style={styles.option}
                            onPress={() => setConfirmVisible(true)}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <Text style={styles.deleteText}>Delete Account</Text>
                            )}
                        </TouchableOpacity>
                    </View>


                    {/* ABOUT */}
                    <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>
                        About
                    </Text>


                    <View style={[styles.card, themeStyles.card]}>
                        <View style={styles.row}>
                            <Text style={[styles.optionText, themeStyles.text]}>
                                App Version
                            </Text>
                            <Text style={[styles.versionText, themeStyles.text]}>
                                {Constants.expoConfig?.version || "1.0.0"}
                            </Text>
                        </View>
                    </View>


                    {/* LOGOUT */}
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>


                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => router.back()}
                    >
                        <Text style={[styles.backText, themeStyles.text]}>Go Back</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>


            {/* ================= CONFIRM MODAL ================= */}


            <Modal transparent visible={confirmVisible} animationType="fade">
                <View style={modalStyles.overlay}>
                    <View
                        style={[
                            modalStyles.modalContainer,
                            { backgroundColor: isDark ? "#1f2937" : "#ffffff" },
                        ]}
                    >
                        <Text
                            style={[
                                modalStyles.title,
                                { color: isDark ? "#fff" : "#000" },
                            ]}
                        >
                            Delete Account
                        </Text>
                        <Text
                            style={[
                                modalStyles.message,
                                { color: isDark ? "#ccc" : "#555" },
                            ]}
                        >
                            This action is permanent. Do you want to continue?
                        </Text>


                        <View style={modalStyles.buttonRow}>
                            <TouchableOpacity
                                style={modalStyles.cancelBtn}
                                onPress={() => setConfirmVisible(false)}
                            >
                                <Text
                                    style={{
                                        fontSize: 16,
                                        color: isDark ? "#ccc" : "#555",
                                    }}
                                >
                                    Cancel
                                </Text>
                            </TouchableOpacity>


                            <TouchableOpacity
                                style={modalStyles.deleteBtn}
                                onPress={handleDeleteAccount}
                            >
                                <Text style={modalStyles.deleteTextBtn}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};


export default SettingScreen;


/* ================= STYLES ================= */


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "transparent" },


    header: {
        padding: 25,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        alignItems: "center",
    },


    headerText: {
        color: "white",
        fontSize: 22,
        fontWeight: "bold",
    },


    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 10,
        marginTop: 20,
        textTransform: "uppercase",
    },


    card: {
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 15,
        marginBottom: 10,
        elevation: 3,
    },


    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
    },


    option: { paddingVertical: 14 },


    optionText: { fontSize: 16 },


    deleteText: { fontSize: 16, color: "#ef4444" },


    versionText: { fontSize: 14, opacity: 0.7 },


    logoutBtn: {
        backgroundColor: "#ef4444",
        padding: 16,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 20,
    },


    logoutText: { color: "white", fontWeight: "bold" },


    backBtn: { marginTop: 15, alignItems: "center" },


    backText: { fontWeight: "600" },
});


/* ================= THEMES ================= */


const lightTheme = StyleSheet.create({
    container: { backgroundColor: "transparent" },
    card: { backgroundColor: "rgba(255,255,255,0.85)" },
    text: { color: "#111827" },
    sectionTitle: { color: "#6b7280" },
});


const darkTheme = StyleSheet.create({
    container: { backgroundColor: "transparent" },
    card: { backgroundColor: "rgba(31,41,55,0.85)" },
    text: { color: "#f9fafb" },
    sectionTitle: { color: "#b8bcc4" },
});


/* ================= MODAL STYLES ================= */


const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },


    modalContainer: {
        width: "85%",
        borderRadius: 20,
        padding: 20,
    },


    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 10,
    },


    message: {
        fontSize: 14,
        marginBottom: 20,
    },


    buttonRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
    },


    cancelBtn: {
        marginRight: 15,
    },


    deleteBtn: {
        backgroundColor: "#ef4444",
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 10,
    },


    deleteTextBtn: {
        color: "white",
        fontWeight: "bold",
    },
});



