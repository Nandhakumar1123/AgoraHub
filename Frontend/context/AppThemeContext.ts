import { createContext } from 'react';

type ThemeMode = 'light' | 'dark';

type AppThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
};

export const AppContext = createContext<AppThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});
