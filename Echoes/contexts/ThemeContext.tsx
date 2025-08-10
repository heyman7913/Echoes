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
      primary: '#2E7D32',
      primaryVariant: '#1B5E20',
      secondary: '#66BB6A',
      background: '#E8F5E9',
      surface: '#ffffff',
      surfaceVariant: '#F1F8E9',
      onPrimary: '#ffffff',
      onSecondary: '#1B5E20',
      onBackground: '#1B5E20',
      onSurface: '#1B5E20',
      text: '#1B5E20',
      textSecondary: '#2E7D32',
      border: '#A5D6A7',
      card: '#ffffff',
      notification: '#ff6b6b',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#d32f2f',
      shadow: 'rgba(46,125,50,0.15)',
    },
  },
  ocean: {
    name: 'Ocean',
    colors: {
      primary: '#0077B6',
      primaryVariant: '#023E8A',
      secondary: '#00B4D8',
      background: '#CAF0F8',
      surface: '#ffffff',
      surfaceVariant: '#E6F7FF',
      onPrimary: '#ffffff',
      onSecondary: '#023E8A',
      onBackground: '#023E8A',
      onSurface: '#023E8A',
      text: '#023E8A',
      textSecondary: '#0077B6',
      border: '#90E0EF',
      card: '#ffffff',
      notification: '#ff6b6b',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#d32f2f',
      shadow: 'rgba(0,119,182,0.15)',
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
