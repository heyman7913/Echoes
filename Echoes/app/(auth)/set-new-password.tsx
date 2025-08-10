import React, { useState } from "react";
import { View } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { supabase } from "../../supabase/client";
import { useRouter } from "expo-router";

export default function SetNewPasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");
    
    // Update the user's password
    const { data, error } = await supabase.auth.updateUser({ 
      password: newPassword 
    });

    if (error) {
      setError(error.message);
    } else {
      // Remove the must_change_password flag
      await supabase.auth.updateUser({
        data: { must_change_password: false }
      });

      setSuccess("Password set successfully!");
      setTimeout(() => {
        router.replace("/(tabs)/memories");
      }, 2000);
    }
    
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text variant="headlineMedium" style={{ marginBottom: 20 }}>
        Set New Password
      </Text>
      
      <Text style={{ marginBottom: 16, fontSize: 16 }}>
        Please set a new secure password for your account.
      </Text>
      
      <TextInput
        label="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        style={{ marginBottom: 16 }}
      />
      
      <TextInput
        label="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={{ marginBottom: 16 }}
      />
      
      {error ? <Text style={{ color: "red", marginBottom: 16 }}>{error}</Text> : null}
      {success ? <Text style={{ color: "green", marginBottom: 16 }}>{success}</Text> : null}
      
      <Button
        mode="contained"
        onPress={handleSetPassword}
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        Set Password
      </Button>
    </View>
  );
}
