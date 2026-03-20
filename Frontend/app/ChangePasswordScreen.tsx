import React, { useState, useContext } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from "react-native";
import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppContext } from "./_layout";


const BASE_URL =
    Platform.OS === "web"
        ? "http://localhost:3002"
        : "http://10.14.105.170:3002";


interface ApiErrorResponse {
    error?: string;
    message?: string;
}


export default function ChangePasswordScreen() {
    const router = useRouter();
    const { theme } = useContext(AppContext);
    const isDark = theme === "dark";


    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");


    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);


    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);


    const getPasswordStrength = (password: string) => {
        if (password.length === 0)
            return { label: "", color: "#ccc", width: 0 };


        let score = 0;


        if (password.length >= 6) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;


        if (score <= 1)
            return { label: "Weak", color: "#ef4444", width: 33 };


        if (score === 2)
            return { label: "Medium", color: "#f59e0b", width: 66 };


        return { label: "Strong", color: "#22c55e", width: 100 };
    };


    const strength = getPasswordStrength(newPassword);


    const handleChangePassword = async () => {
        setMessage("");


        if (!oldPassword || !newPassword || !confirmPassword) {
            setIsError(true);
            setMessage("All fields are required");
            return;
        }


        if (newPassword.length < 6) {
            setIsError(true);
            setMessage("New password must be at least 6 characters");
            return;
        }


        if (newPassword !== confirmPassword) {
            setIsError(true);
            setMessage("New passwords do not match");
            return;
        }


        try {
            setLoading(true);
            setIsError(false);


            const token = await AsyncStorage.getItem("authToken");


            if (!token) {
                setIsError(true);
                setMessage("Session expired. Please login again.");
                return;
            }


            const response = await axios.post(
                `${BASE_URL}/api/change-password`,
                {
                    oldPassword,
                    newPassword,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );


            setMessage(response.data.message || "Password changed successfully");


            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");


            await AsyncStorage.removeItem("authToken");


            setTimeout(() => {
                router.replace("/LoginScreen");
            }, 1500);
        } catch (error) {
            setIsError(true);


            if (axios.isAxiosError(error)) {
                const err = error as AxiosError<ApiErrorResponse>;
                setMessage(
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    "Password change failed"
                );
            } else {
                setMessage("Something went wrong");
            }
        } finally {
            setLoading(false);
        }
    };


    const renderPasswordField = (
        label: string,
        value: string,
        setValue: any,
        show: boolean,
        setShow: any
    ) => (
        <>
            <Text style={[styles.label, { color: isDark ? "#d1d5db" : "#333" }]}>
                {label}
            </Text>


            <View
                style={[
                    styles.inputContainer,
                    {
                        backgroundColor: isDark ? "#1f2937" : "#fff",
                        borderColor: isDark ? "#374151" : "#ddd",
                    },
                ]}
            >
                <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={isDark ? "#9ca3af" : "#666"}
                />


                <TextInput
                    style={[styles.inputField, { color: isDark ? "#fff" : "#000" }]}
                    secureTextEntry={!show}
                    value={value}
                    onChangeText={setValue}
                    placeholder={label}
                    placeholderTextColor={isDark ? "#9ca3af" : "#999"}
                />


                <TouchableOpacity onPress={() => setShow(!show)}>
                    <Ionicons
                        name={show ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color={isDark ? "#9ca3af" : "#666"}
                    />
                </TouchableOpacity>
            </View>
        </>
    );


    return (
        <View
            style={[
                styles.container,
                { backgroundColor: "transparent" },
            ]}
        >
            <Text
                style={[
                    styles.title,
                    { color: isDark ? "#fff" : "#111827" },
                ]}
            >
                Change Password
            </Text>


            {renderPasswordField(
                "Old Password",
                oldPassword,
                setOldPassword,
                showOldPassword,
                setShowOldPassword
            )}


            {renderPasswordField(
                "New Password",
                newPassword,
                setNewPassword,
                showNewPassword,
                setShowNewPassword
            )}


            {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                    <View style={styles.strengthBarBackground}>
                        <View
                            style={[
                                styles.strengthBar,
                                {
                                    width: `${strength.width}%`,
                                    backgroundColor: strength.color,
                                },
                            ]}
                        />
                    </View>


                    <Text style={{ color: strength.color, marginTop: 4 }}>
                        {strength.label} Password
                    </Text>
                </View>
            )}


            {renderPasswordField(
                "Confirm Password",
                confirmPassword,
                setConfirmPassword,
                showConfirmPassword,
                setShowConfirmPassword
            )}


            {message !== "" && (
                <Text
                    style={[
                        styles.message,
                        { color: isError ? "#ef4444" : "#22c55e" },
                    ]}
                >
                    {message}
                </Text>
            )}


            <TouchableOpacity
                style={[
                    styles.button,
                    { backgroundColor: isDark ? "#2563eb" : "#007bff" },
                ]}
                onPress={handleChangePassword}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Update Password</Text>
                )}
            </TouchableOpacity>


            <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.replace("/LoginScreen")}
            >
                <Text
                    style={[
                        styles.linkText,
                        { color: isDark ? "#60a5fa" : "#007bff" },
                    ]}
                >
                    Return to Login
                </Text>
            </TouchableOpacity>
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
        backgroundColor: "transparent"
    },


    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 30,
        textAlign: "center",
    },


    label: {
        fontSize: 14,
        marginBottom: 5,
        fontWeight: "600",
    },


    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        marginBottom: 15,
    },


    inputField: {
        flex: 1,
        padding: 12,
    },


    strengthContainer: {
        marginBottom: 15,
    },


    strengthBarBackground: {
        height: 6,
        backgroundColor: "#e5e7eb",
        borderRadius: 4,
    },


    strengthBar: {
        height: 6,
        borderRadius: 4,
    },


    button: {
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 10,
    },


    buttonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
    },


    message: {
        textAlign: "center",
        marginBottom: 10,
        fontWeight: "600",
    },


    linkButton: {
        marginTop: 20,
        alignItems: "center",
    },


    linkText: {
        fontWeight: "600",
    },
});



