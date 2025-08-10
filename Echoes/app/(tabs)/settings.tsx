import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabase/client';
import { useRouter } from 'expo-router';
import { useTheme, themes } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  theme: any;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  rightElement,
  theme,
}) => (
  <TouchableOpacity style={[styles.settingsItem, { backgroundColor: theme.colors.card }]} onPress={onPress}>
    <View style={styles.settingsItemLeft}>
      <MaterialCommunityIcons
        name={icon as any}
        size={24}
        color={theme.colors.primary}
        style={styles.settingsIcon}
      />
      <View style={styles.settingsText}>
        <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.settingsSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
    {rightElement || (
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={theme.colors.textSecondary}
      />
    )}
  </TouchableOpacity>
);

interface ThemePreviewProps {
  themeName: string;
  theme: any;
  isSelected: boolean;
  onSelect: () => void;
  currentThemeColors: any;
}

const ThemePreview: React.FC<ThemePreviewProps> = ({
  themeName,
  theme,
  isSelected,
  onSelect,
  currentThemeColors,
}) => (
  <TouchableOpacity
    style={[
      styles.themePreview,
      {
        borderColor: isSelected ? currentThemeColors.primary : currentThemeColors.border,
        borderWidth: isSelected ? 2 : 1,
        backgroundColor: currentThemeColors.card,
      },
    ]}
    onPress={onSelect}
  >
    <View style={styles.themeColors}>
      <View style={[styles.themeColorCircle, { backgroundColor: theme.colors.primary }]} />
      <View style={[styles.themeColorCircle, { backgroundColor: theme.colors.secondary }]} />
      <View style={[styles.themeColorCircle, { backgroundColor: theme.colors.background }]} />
    </View>
    <Text style={[styles.themeName, { color: currentThemeColors.text }]}>{theme.name}</Text>
    {isSelected && (
      <MaterialCommunityIcons
        name="check-circle"
        size={20}
        color={currentThemeColors.primary}
        style={styles.themeSelected}
      />
    )}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { currentTheme, themeName, setTheme, availableThemes } = useTheme();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  const handleThemeSelect = (selectedTheme: string) => {
    setTheme(selectedTheme);
  };

  const getThemeDescription = (themeKey: string) => {
    const descriptions = {
      light: 'Clean and minimal for daytime use',
      dark: 'Easy on the eyes for evening sessions',
      forest: 'Natural greens for mindfulness and grounding',
      ocean: 'Calming blues for peace and tranquility',
    };
    return descriptions[themeKey as keyof typeof descriptions] || 'Custom theme';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: currentTheme.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.onPrimary }]}>
          Settings
        </Text>
        <Text style={[styles.headerSubtitle, { color: currentTheme.colors.onPrimary }]}>
          Customize your Echoes experience
        </Text>
      </View>

      <View style={styles.content}>
        {/* Appearance Section */}
        <Card style={[styles.section, { backgroundColor: currentTheme.colors.card }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="palette"
                size={24}
                color={currentTheme.colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                Appearance
              </Text>
            </View>
            
            <Text style={[styles.sectionDescription, { color: currentTheme.colors.textSecondary }]}>
              Choose a theme that resonates with your mood and mindfulness journey
            </Text>

            <View style={styles.themesGrid}>
              {availableThemes.map((themeKey) => (
                <ThemePreview
                  key={themeKey}
                  themeName={themeKey}
                  theme={themes[themeKey]}
                  isSelected={themeName === themeKey}
                  onSelect={() => handleThemeSelect(themeKey)}
                  currentThemeColors={currentTheme.colors}
                />
              ))}
            </View>

            <Text style={[styles.currentThemeText, { color: currentTheme.colors.textSecondary }]}>
              Current: {currentTheme.name} - {getThemeDescription(themeName)}
            </Text>
          </Card.Content>
        </Card>

        {/* Account Section */}
        <Card style={[styles.section, { backgroundColor: currentTheme.colors.card }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="account"
                size={24}
                color={currentTheme.colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                Account
              </Text>
            </View>

            <SettingsItem
              title="Privacy & Data"
              subtitle="Manage your data and privacy settings"
              icon="shield-account"
              onPress={() => Alert.alert('Coming Soon', 'Privacy settings will be available in a future update.')}
              theme={currentTheme}
            />

            <Divider style={{ marginVertical: 8, backgroundColor: currentTheme.colors.border }} />

            <SettingsItem
              title="Export Memories"
              subtitle="Download your memories and transcripts"
              icon="download"
              onPress={() => Alert.alert('Coming Soon', 'Memory export will be available in a future update.')}
              theme={currentTheme}
            />
          </Card.Content>
        </Card>

        {/* Support Section */}
        <Card style={[styles.section, { backgroundColor: currentTheme.colors.card }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="help-circle"
                size={24}
                color={currentTheme.colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                Support & Feedback
              </Text>
            </View>

            <SettingsItem
              title="Help & FAQ"
              subtitle="Get help with using Echoes"
              icon="help-circle-outline"
              onPress={() => Alert.alert('Coming Soon', 'Help documentation will be available soon.')}
              theme={currentTheme}
            />

            <Divider style={{ marginVertical: 8, backgroundColor: currentTheme.colors.border }} />

            <SettingsItem
              title="Send Feedback"
              subtitle="Share your thoughts and suggestions"
              icon="message-outline"
              onPress={() => Alert.alert('Coming Soon', 'Feedback system will be available soon.')}
              theme={currentTheme}
            />

            <Divider style={{ marginVertical: 8, backgroundColor: currentTheme.colors.border }} />

            <SettingsItem
              title="About Echoes"
              subtitle="Version 1.0.0"
              icon="information-outline"
              onPress={() => Alert.alert('About Echoes', 'Echoes v1.0.0\n\nYour personal AI-powered memory and therapy companion.')}
              theme={currentTheme}
            />
          </Card.Content>
        </Card>

        {/* Danger Zone */}
        <Card style={[styles.section, styles.dangerSection, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.error }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={24}
                color={currentTheme.colors.error}
              />
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.error }]}>
                Account Actions
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={[styles.logoutButton, { backgroundColor: currentTheme.colors.error }]}
              contentStyle={styles.logoutButtonContent}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={currentTheme.colors.onPrimary} />
              ) : (
                'Logout'
              )}
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: currentTheme.colors.textSecondary }]}>
            Made with ❤️ for mindfulness and emotional wellbeing
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    marginRight: 16,
  },
  settingsText: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  themePreview: {
    width: (width - 80) / 2,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    position: 'relative',
  },
  themeColors: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  themeColorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 2,
  },
  themeName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  themeSelected: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  currentThemeText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  dangerSection: {
    borderWidth: 1,
  },
  logoutButton: {
    marginTop: 8,
  },
  logoutButtonContent: {
    paddingVertical: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
