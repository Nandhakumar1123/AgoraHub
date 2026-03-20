import React, { useContext, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Dimensions,
    Modal,
    Button,
} from "react-native";


import * as ImagePicker from "expo-image-picker";
import Slider from "@react-native-community/slider";


import { AppContext } from "./_layout";


const { width, height } = Dimensions.get("window");


/* ===== SAMPLE WALLPAPERS ===== */


const wallpapers = [
    "https://picsum.photos/id/1015/800/1200",
    "https://picsum.photos/id/1016/800/1200",
    "https://picsum.photos/id/1018/800/1200",
    "https://picsum.photos/id/1020/800/1200",
    "https://picsum.photos/id/1024/800/1200",
    "https://picsum.photos/id/1025/800/1200",
    "https://picsum.photos/id/1031/800/1200",
    "https://picsum.photos/id/1035/800/1200",
    "https://picsum.photos/id/1037/800/1200",
];


/* ===== GRADIENT OPTIONS ===== */


const gradients = [
    ["#6366f1", "#8b5cf6"],
    ["#0ea5e9", "#22c55e"],
    ["#f97316", "#ef4444"],
    ["#06b6d4", "#3b82f6"],
    ["#111827", "#000000"],
];


export default function WallpaperScreen() {
    const {
        updateWallpaper,
        updateGradient,
        updateBlur,
        blur,
    } = useContext(AppContext);


    const [preview, setPreview] = useState<string | null>(null);
    const [gradientPreview, setGradientPreview] = useState<any>(null);


    /* ===== PICK FROM DEVICE ===== */


    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();


        if (!permission.granted) {
            alert("Permission required");
            return;
        }


        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [9, 16],
            quality: 1,
        });


        if (!result.canceled) {
            setPreview(result.assets[0].uri);
        }
    };


    /* ===== APPLY WALLPAPER ===== */


    const applyWallpaper = () => {
        if (preview) updateWallpaper(preview);
        if (gradientPreview) updateGradient(gradientPreview);


        setPreview(null);
        setGradientPreview(null);
    };


    /* ===== REMOVE WALLPAPER ===== */


    const removeWallpaper = () => {
        updateWallpaper(null);
    };


    return (
        <View style={styles.container}>


            <Text style={styles.title}>Wallpapers</Text>


            {/* GRID */}


            <FlatList
                data={wallpapers}
                numColumns={5}
                keyExtractor={(item, i) => i.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setPreview(item)}>
                        <Image source={{ uri: item }} style={styles.wallpaper} />
                    </TouchableOpacity>
                )}
            />


            {/* DEVICE PICK */}


            <TouchableOpacity style={styles.button} onPress={pickImage}>
                <Text style={styles.buttonText}>Choose From Device</Text>
            </TouchableOpacity>


            {/* REMOVE */}


            <TouchableOpacity style={styles.removeBtn} onPress={removeWallpaper}>
                <Text style={styles.buttonText}>Remove Wallpaper</Text>
            </TouchableOpacity>


            {/* GRADIENTS */}


            <Text style={styles.title}>Gradient Wallpapers</Text>


            <FlatList
                data={gradients}
                numColumns={5}
                keyExtractor={(item, i) => i.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.gradient, { backgroundColor: item[0] }]}
                        onPress={() => setGradientPreview(item)}
                    />
                )}
            />


            {/* BLUR CONTROL */}


            <Text style={styles.title}>Blur</Text>


            <Slider
                minimumValue={0}
                maximumValue={100}
                value={blur}
                onValueChange={updateBlur}
            />


            {/* PREVIEW MODAL */}


            <Modal visible={!!preview || !!gradientPreview} animationType="fade">
                <View style={{ flex: 1 }}>


                    {preview && (
                        <Image
                            source={{ uri: preview }}
                            style={{ width: width, height: height }}
                            resizeMode="cover"
                        />
                    )}


                    {gradientPreview && (
                        <View
                            style={{
                                flex: 1,
                                backgroundColor: gradientPreview[0],
                            }}
                        />
                    )}


                    <View style={styles.previewBar}>
                        <Button title="Cancel" onPress={() => {
                            setPreview(null);
                            setGradientPreview(null);
                        }} />


                        <Button title="Apply" onPress={applyWallpaper} />
                    </View>


                </View>
            </Modal>


        </View>
    );
}


/* ===== STYLES ===== */


const styles = StyleSheet.create({


    container: {
        flex: 1,
        padding: 15,
    },


    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginVertical: 10,
        color: "#fff",
    },


    wallpaper: {
        width: width / 5 - 10,
        height: width / 5 - 10,
        margin: 5,
        borderRadius: 10,
    },


    gradient: {
        width: width / 5 - 10,
        height: width / 5 - 10,
        margin: 5,
        borderRadius: 10,
    },


    button: {
        backgroundColor: "#6366f1",
        padding: 12,
        borderRadius: 10,
        marginVertical: 10,
        alignItems: "center",
    },


    removeBtn: {
        backgroundColor: "#ef4444",
        padding: 12,
        borderRadius: 10,
        marginVertical: 5,
        alignItems: "center",
    },


    buttonText: {
        color: "white",
        fontWeight: "bold",
    },


    previewBar: {
        position: "absolute",
        bottom: 40,
        left: 20,
        right: 20,
        flexDirection: "row",
        justifyContent: "space-between",
    },


});



