import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { supabase } from "../../supabase/client";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TabsLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) router.replace("/(auth)/login");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) router.replace("/(auth)/login");
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6200ee",
      }}
    >
      <Tabs.Screen
        name="memories"
        options={{
          title: "Memories",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="microphone"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="microphone"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="therapist"
        options={{
          title: "Therapist",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-heart"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
