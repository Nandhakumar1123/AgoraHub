import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";


/* ================= TYPES ================= */


type WallpaperType =
    | { type: "image"; value: string }
    | { type: "gradient"; value: string[] }
    | null;


type WallpaperContextType = {
    wallpaper: WallpaperType;
    blur: number;


    setImageWallpaper: (uri: string) => void;
    setGradientWallpaper: (colors: string[]) => void;
    clearWallpaper: () => void;
    setBlur: (value: number) => void;
};


/* ================= CONTEXT ================= */


const WallpaperContext = createContext<WallpaperContextType>({
    wallpaper: null,
    blur: 25,


    setImageWallpaper: () => { },
    setGradientWallpaper: () => { },
    clearWallpaper: () => { },
    setBlur: () => { },
});


/* ================= PROVIDER ================= */


export const WallpaperProvider = ({ children }: any) => {
    const [wallpaper, setWallpaper] = useState<WallpaperType>(null);
    const [blur, setBlurState] = useState(25);


    /* ================= LOAD FROM STORAGE ================= */


    useEffect(() => {
        const loadWallpaper = async () => {
            try {
                const savedWallpaper = await AsyncStorage.getItem("APP_WALLPAPER");
                const savedGradient = await AsyncStorage.getItem("APP_GRADIENT");
                const savedBlur = await AsyncStorage.getItem("APP_BLUR");


                if (savedWallpaper) {
                    setWallpaper({ type: "image", value: savedWallpaper });
                }


                if (savedGradient) {
                    setWallpaper({
                        type: "gradient",
                        value: JSON.parse(savedGradient),
                    });
                }


                if (savedBlur) {
                    setBlurState(Number(savedBlur));
                }
            } catch (err) {
                console.log("Wallpaper load error", err);
            }
        };


        loadWallpaper();
    }, []);


    /* ================= SET IMAGE ================= */


    const setImageWallpaper = async (uri: string) => {
        setWallpaper({ type: "image", value: uri });


        await AsyncStorage.setItem("APP_WALLPAPER", uri);
        await AsyncStorage.removeItem("APP_GRADIENT");
    };


    /* ================= SET GRADIENT ================= */


    const setGradientWallpaper = async (colors: string[]) => {
        setWallpaper({ type: "gradient", value: colors });


        await AsyncStorage.setItem("APP_GRADIENT", JSON.stringify(colors));
        await AsyncStorage.removeItem("APP_WALLPAPER");
    };


    /* ================= CLEAR ================= */


    const clearWallpaper = async () => {
        setWallpaper(null);


        await AsyncStorage.removeItem("APP_WALLPAPER");
        await AsyncStorage.removeItem("APP_GRADIENT");
    };


    /* ================= BLUR ================= */


    const setBlur = async (value: number) => {
        setBlurState(value);
        await AsyncStorage.setItem("APP_BLUR", value.toString());
    };


    return (
        <WallpaperContext.Provider
            value={{
                wallpaper,
                blur,
                setImageWallpaper,
                setGradientWallpaper,
                clearWallpaper,
                setBlur,
            }}
        >
            {children}
        </WallpaperContext.Provider>
    );
};


/* ================= HOOK ================= */


export const useWallpaper = () => useContext(WallpaperContext);



