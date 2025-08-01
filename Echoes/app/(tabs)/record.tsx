import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { supabase } from "../../supabase/client";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function RecordScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<number | null>(null);

  const [audioLevels, setAudioLevels] = useState<number[]>(Array(32).fill(0));
  const audioAnalysisInterval = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Audio recording permission is required"
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      startRealTimeAudioAnalysis();

      const pulse = () => {
        const avg =
          audioLevels.reduce((sum, lvl) => sum + lvl, 0) / audioLevels.length;
        const intensity = Math.min(1.3, 1 + (avg / 100) * 0.3);

        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: intensity,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isRecording && !isPaused) pulse();
        });
      };
      pulse();

      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      stopRealTimeAudioAnalysis();
      pulseAnim.setValue(1);
      rippleAnim.setValue(0);
      buttonScaleAnim.setValue(1);
      if (!isRecording) setAudioLevels(Array(32).fill(0));
    }
  }, [isRecording, isPaused]);

  const startRealTimeAudioAnalysis = () => {
    if (audioAnalysisInterval.current)
      clearInterval(audioAnalysisInterval.current);
    audioAnalysisInterval.current = setInterval(async () => {
      if (!recording || isPaused) return;
      try {
        await recording.getStatusAsync();
        const levels = Array(32)
          .fill(0)
          .map(() => Math.max(Math.random() * 10, Math.random() * 50));
        setAudioLevels(levels);
      } catch {
        setAudioLevels(
          Array(32)
            .fill(0)
            .map(() => Math.random() * 60)
        );
      }
    }, 50);
  };

  const stopRealTimeAudioAnalysis = () => {
    if (audioAnalysisInterval.current) {
      clearInterval(audioAnalysisInterval.current);
      audioAnalysisInterval.current = null;
    }
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingTime(0);
      setTranscript("");
      timerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    try {
      if (isPaused) {
        await recording.startAsync();
        setIsPaused(false);
      } else {
        await recording.pauseAsync();
        setIsPaused(true);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to pause/resume recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      setIsPaused(false);
      setIsProcessing(true);
      if (timerRef.current) clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        const text = await callAssemblyAI(uri);
        setTranscript(text);
      }
      setRecording(null);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to stop recording");
    } finally {
      setIsProcessing(false);
    }
  };

  const callAssemblyAI = async (audioUri: string) => {
    const API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_KEY!; // ignore the type - compiler stops throwing random problems.
    const up = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: await fetch(audioUri).then((r) => r.arrayBuffer()),
    });
    const { upload_url } = await up.json();

    const tx = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { Authorization: API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: upload_url,
        punctuate: true,
        format_text: true,
      }),
    });
    const { id } = await tx.json();

    let result: string | null = null;
    while (!result) {
      await new Promise((r) => setTimeout(r, 1000));
      const st = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { Authorization: API_KEY },
      }).then((r) => r.json());
      if (st.status === "completed") result = st.text;
      if (st.status === "error") throw new Error(st.error);
    }
    return result;
  };

  const saveToSupabase = async (text: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return Alert.alert("Error", "User not authenticated");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("memories")
        .insert({ user_id: user.id, transcript: text, created_at: now });
      if (error) throw error;
      Alert.alert("Success", "Memory saved!");
      setTranscript("");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save memory");
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const renderWaveform = () => (
    <View style={styles.waveformContainer}>
      {audioLevels.map((lvl, i) => {
        const h =
          isRecording && !isPaused ? Math.max(3, Math.min(80, lvl)) : 12;
        const o = isRecording && !isPaused ? Math.min(1, lvl / 60) : 0.2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.waveformBar,
              { height: h, backgroundColor: `rgba(98,0,238,${o})` },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Record Now</Text>

      <View style={styles.recordingContainer}>
        <TouchableOpacity
          style={styles.recordButtonContainer}
          onPress={isRecording ? undefined : startRecording}
          disabled={isRecording || isProcessing}
          activeOpacity={0.8}
        >
          {isRecording && (
            <Animated.View
              style={[
                styles.rippleEffect,
                {
                  transform: [
                    {
                      scale: rippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.5],
                      }),
                    },
                  ],
                  opacity: rippleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 0],
                  }),
                },
              ]}
            />
          )}
          <Animated.View
            style={[styles.recordButton, { transform: [{ scale: pulseAnim }] }]}
          >
            <LinearGradient
              colors={
                isRecording
                  ? ["#ff6b6b", "#ee5a52", "#ff4444"]
                  : ["#667eea", "#764ba2", "#6200ee"]
              }
              style={styles.gradient}
            >
              <MaterialCommunityIcons
                name={isRecording ? "microphone" : "microphone-outline"}
                size={isRecording ? 45 : 40}
                color="white"
              />
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.waveformWrapper}>{renderWaveform()}</View>

      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
        <Text style={styles.timerLabel}>
          {isRecording
            ? isPaused
              ? "Paused"
              : "Recording..."
            : "Ready to record"}
        </Text>
      </View>

      {isRecording && (
        <View style={styles.controlButtonsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, styles.pauseButton]}
            onPress={pauseRecording}
          >
            <MaterialCommunityIcons
              name={isPaused ? "play" : "pause"}
              size={24}
              color="white"
            />
            <Text style={styles.controlButtonText}>
              {isPaused ? "Resume" : "Pause"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={stopRecording}
          >
            <MaterialCommunityIcons name="stop" size={24} color="white" />
            <Text style={styles.controlButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {isProcessing && (
        <Text style={styles.processingText}>Processing audio...</Text>
      )}

      {transcript !== "" && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptTitle}>Transcript:</Text>
          <Text style={styles.transcriptText}>{transcript}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => saveToSupabase(transcript)}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.discardButton}
              onPress={() => setTranscript("")}
            >
              <Text style={styles.discardButtonText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 40,
    textAlign: "center",
  },
  recordingContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  recordButtonContainer: {
    alignItems: "center",
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  rippleEffect: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,107,107,0.3)",
  },
  gradient: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  waveformWrapper: {
    marginBottom: 30,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 100,
    width: width - 40,
    paddingHorizontal: 10,
  },
  waveformBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 2,
    minHeight: 5,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  timerText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#333",
    fontFamily: "monospace",
  },
  timerLabel: {
    fontSize: 16,
    color: "#666",
    marginTop: 5,
  },
  controlButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginBottom: 30,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pauseButton: {
    backgroundColor: "#6200ee",
  },
  stopButton: {
    backgroundColor: "#ff4444",
  },
  controlButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  processingText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 30,
  },
  transcriptContainer: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  transcriptText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    width: "100%",
  },
  saveButton: {
    backgroundColor: "#6200ee",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  discardButton: {
    backgroundColor: "#eee",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  discardButtonText: {
    color: "#6200ee",
    fontWeight: "bold",
  },
});
