import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Theme {
  name: string;
  colors: {
    primary: string;
    primaryVariant: string;
    secondary: string;
    background: string;
    surface: string;
    surfaceVariant: string;
    onPrimary: string;
    onSecondary: string;
    onBackground: string;
    onSurface: string;
    text: string;
    textSecondary: string;
    border: string;
    card: string;
    notification: string;
    success: string;
    warning: string;
    error: string;
    shadow: string;
  };
}

export const themes: { [key: string]: Theme } = {
  light: {
    name: 'Light',
    colors: {
      primary: '#6200ee',
      primaryVariant: '#3700b3',
      secondary: '#03dac6',
      background: '#f5f5f5',
      surface: '#ffffff',
      surfaceVariant: '#f8f9fa',
      onPrimary: '#ffffff',
      onSecondary: '#000000',
      onBackground: '#000000',
      onSurface: '#000000',
      text: '#333333',
      textSecondary: '#666666',
      border: '#e0e0e0',
      card: '#ffffff',
      notification: '#ff6b6b',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336',
      shadow: 'rgba(0,0,0,0.1)',
    },
  },
  dark: {
    name: 'Dark',
    colors: {
      primary: '#bb86fc',
      primaryVariant: '#3700b3',
      secondary: '#03dac6',
      background: '#121212',
      surface: '#1e1e1e',
      surfaceVariant: '#2d2d2d',
      onPrimary: '#000000',
      onSecondary: '#000000',
      onBackground: '#ffffff',
      onSurface: '#ffffff',
      text: '#ffffff',
      textSecondary: '#b3b3b3',
      border: '#404040',
      card: '#1e1e1e',
      notification: '#ff6b6b',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#cf6679',
      shadow: 'rgba(0,0,0,0.3)',
    },
  },
  forest: {
    name: 'Forest',
    colors: {
      primary: '#2F6D5C',
      primaryVariant: '#225E52',
      secondary: '#86BA90',
      background: '#F3F7F4',
      surface: '#FFFFFF',
      surfaceVariant: '#ECF2EE',
      onPrimary: '#FFFFFF',
      onSecondary: '#1F3D36',
      onBackground: '#1F3D36',
      onSurface: '#1F3D36',
      text: '#1F3D36',
      textSecondary: '#4A6B62',
      border: '#D6E5DB',
      card: '#FFFFFF',
      notification: '#ff6b6b',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#D32F2F',
      shadow: 'rgba(47,109,92,0.15)',
    },
  },
  ocean: {
    name: 'Ocean',
    colors: {
      primary: '#2C7DA0',
      primaryVariant: '#184E77',
      secondary: '#76C893',
      background: '#E8F4FA',
      surface: '#FFFFFF',
      surfaceVariant: '#E9F4F9',
      onPrimary: '#FFFFFF',
      onSecondary: '#0A2A43',
      onBackground: '#0A2A43',
      onSurface: '#0A2A43',
      text: '#0A2A43',
      textSecondary: '#3B647D',
      border: '#C8E6F5',
      card: '#FFFFFF',
      notification: '#ff6b6b',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#d32f2f',
      shadow: 'rgba(24,78,119,0.15)',
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  themeName: string;
  setTheme: (themeName: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeName, setThemeName] = useState<string>('light');

  useEffect(() => {
    // Load saved theme from storage
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme');
        if (savedTheme && themes[savedTheme]) {
          setThemeName(savedTheme);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (newThemeName: string) => {
    if (themes[newThemeName]) {
      setThemeName(newThemeName);
      try {
        await AsyncStorage.setItem('app_theme', newThemeName);
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    }
  };

  const value: ThemeContextType = {
    currentTheme: themes[themeName],
    themeName,
    setTheme,
    availableThemes: Object.keys(themes),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
