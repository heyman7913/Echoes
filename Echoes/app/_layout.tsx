import { Stack } from "expo-router";
import { ThemeProvider } from "../contexts/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const { loading } = useAuthGuard();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ThemeProvider>
  );
}
