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
} from "react-native";
import axios from "axios";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "react-native";


const BASE_URL = "http://10.14.105.170:3002";


const ProfileScreen = () => {
    const theme = useColorScheme();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [showSheet, setShowSheet] = useState(false);
    const [errors, setErrors] = useState<any>({});


    const slideAnim = useRef(new Animated.Value(0)).current;


    const [formDataState, setFormDataState] = useState({
        full_name: "",
        email: "",
        mobile_number: "",
        bio: "",
        description: "",
    });


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
        Animated.timing(slideAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };


    const cancelEdit = () => {
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setEditing(false);
            if (token) fetchProfile(token);
        });
    };


    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0],
    });


    // ================= VALIDATION =================
    const validateForm = () => {
        let newErrors: any = {};


        if (!formDataState.full_name.trim()) {
            newErrors.full_name = "Name is required";
        }


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


        const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;


        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,     // enable crop
            aspect: [1, 1],          // square profile image
            quality: 0.7,
        });


        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };
    const openCamera = async () => {
        setShowSheet(false);
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;


        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,   // enable crop
            aspect: [1, 1],
            quality: 0.7,
        });


        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
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


            if (imageUri) {
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


                await axios.post(
                    `${BASE_URL}/api/profile/upload-image`,
                    formData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }


            Alert.alert("Success", "Profile updated");
            cancelEdit();
        } catch {
            Alert.alert("Update failed");
        }
    };


    const handleLogout = async () => {
        await AsyncStorage.removeItem("authToken");
        router.replace("/LoginScreen");
    };


    if (loading)
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );


    const firstLetter = formDataState.full_name
        ? formDataState.full_name.charAt(0).toUpperCase()
        : "?";


    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* HEADER */}
            <View style={styles.headerCard}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.avatar} />
                ) : (
                    <LinearGradient
                        colors={["#6366f1", "#8b5cf6"]}
                        style={styles.avatar}
                    >
                        <Text style={styles.avatarText}>{firstLetter}</Text>
                    </LinearGradient>
                )}


                <Text
                    style={[styles.name,
                    { color: theme === "dark" ? "#cecccc" : "#333333" }
                    ]}
                >
                    {profile?.full_name}
                </Text>


                <Text
                    style={[
                        styles.email,
                        { color: theme === "dark" ? "#c5c3c3" : "#333333" }
                    ]}
                >
                    {profile?.email}
                </Text>
            </View>


            {!editing && (
                <>
                    <TouchableOpacity style={styles.mainBtn} onPress={toggleEdit}>
                        <Text style={styles.mainBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/SettingScreen")} >
                        <Text style={styles.settingsText}>Settings</Text>
                    </TouchableOpacity>


                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Text style={{ color: "white" }}>Logout</Text>
                    </TouchableOpacity>
                </>
            )}


            {editing && (
                <Animated.View
                    style={{
                        width: "100%",
                        opacity: slideAnim,
                        transform: [{ translateY }],
                    }}
                >
                    <View style={styles.formCard}>
                        <TouchableOpacity
                            style={styles.photoBtn}
                            onPress={() => setShowSheet(true)}
                        >
                            <Text style={{ fontWeight: "600" }}>
                                Change / Remove Photo
                            </Text>
                        </TouchableOpacity>


                        {["full_name", "email", "mobile_number", "bio", "description"].map(
                            (field) => (
                                <View key={field}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            field === "description" && { height: 90 },
                                        ]}
                                        multiline={field === "description"}
                                        value={(formDataState as any)[field]}
                                        onChangeText={(text) =>
                                            setFormDataState({
                                                ...formDataState,
                                                [field]: text,
                                            })
                                        }
                                        placeholder={field.replace("_", " ")}
                                    />
                                    {errors[field] && (
                                        <Text style={styles.errorText}>
                                            {errors[field]}
                                        </Text>
                                    )}
                                </View>
                            )
                        )}


                        <View style={{ flexDirection: "row", gap: 10 }}>
                            <TouchableOpacity
                                style={styles.mainBtn}
                                onPress={handleUpdate}
                            >
                                <Text style={styles.mainBtnText}>Save</Text>
                            </TouchableOpacity>


                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={cancelEdit}
                            >
                                <Text>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            )}


            {/* IMAGE SHEET */}
            <Modal visible={showSheet} transparent animationType="slide">
                <Pressable
                    style={styles.overlay}
                    onPress={() => setShowSheet(false)}
                />
                <View style={styles.sheet}>
                    <TouchableOpacity onPress={openCamera} style={styles.sheetItem}>
                        <Text>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={openGallery} style={styles.sheetItem}>
                        <Text>Choose from Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleRemovePhoto}
                        style={styles.sheetItem}
                    >
                        <Text style={{ color: "red" }}>Remove Photo</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </ScrollView>
    );
};


export default ProfileScreen;


const styles = StyleSheet.create({
    container: { padding: 20 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },


    headerCard: {
        alignItems: "center",
        marginBottom: 25,
    },
    settingsBtn: {
        backgroundColor: "#7dcce0",
        padding: 14,
        borderRadius: 14,
        alignItems: "center",
        marginBottom: 10,
    },


    settingsText: {
        fontWeight: "600",
        color: "white",
    },
    avatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: "center",
        alignItems: "center",
    },


    avatarText: {
        color: "white",
        fontSize: 42,
        fontWeight: "bold",
    },


    name: {
        fontSize: 22,
        fontWeight: "bold",
        marginTop: 12,
    },


    email: {
        fontWeight: "bold",
        marginBottom: 20
    },


    formCard: {
        backgroundColor: "white",
        padding: 20,
        borderRadius: 20,
        elevation: 4,
    },


    input: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        backgroundColor: "#f9fafb",
    },


    errorText: {
        color: "#ef4444",
        fontSize: 12,
        marginBottom: 8,
    },


    mainBtn: {
        backgroundColor: "#6366f1",
        padding: 14,
        borderRadius: 14,
        alignItems: "center",
        marginVertical: 6,
        flex: 1,
    },


    mainBtnText: { color: "white", fontWeight: "bold" },


    cancelBtn: {
        backgroundColor: "#e5e7eb",
        padding: 14,
        borderRadius: 14,
        alignItems: "center",
        marginVertical: 6,
        flex: 1,
    },


    logoutBtn: {
        backgroundColor: "#ef4444",
        padding: 14,
        borderRadius: 14,
        alignItems: "center",
    },


    photoBtn: {
        backgroundColor: "#f3f4f6",
        padding: 14,
        borderRadius: 14,
        alignItems: "center",
        marginBottom: 15,
    },


    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
    },


    sheet: {
        backgroundColor: "white",
        padding: 20,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
    },


    sheetItem: {
        paddingVertical: 16,
        alignItems: "center",
    },
});



