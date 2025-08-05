import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  ScrollView,
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
  const [finalDuration, setFinalDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [audioLevels, setAudioLevels] = useState<number[]>(Array(32).fill(0));
  const audioAnalysisInterval = useRef<NodeJS.Timeout | null>(null);

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
      setFinalDuration(recordingTime);
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
      
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
      
      // First save with basic info, then update with AI-generated content
      const { data, error } = await supabase
        .from("memories")
        .insert({ 
          user_id: user.id, 
          transcript: text, 
          created_at: now.toISOString(),
          day_of_week: dayOfWeek,
          duration: finalDuration,
          title: "Processing...",
          summary: "Processing...",
          emotion: "neutral"
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Process AI features in background
      processAIFeatures(data.id, text);
      
      Alert.alert("Success", "Memory saved!");
      setTranscript("");
      setFinalDuration(0);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save memory");
    }
  };

  const processAIFeatures = async (memoryId: string, transcript: string) => {
    try {
      // Generate summary using free API (Hugging Face)
      const summary = await generateSummary(transcript);
      
      // Generate title based on summary
      const title = await generateTitle(summary);
      
      // Detect emotion
      const emotion = await detectEmotion(transcript);
      
      // Update the memory with AI-generated content
      await supabase
        .from("memories")
        .update({ 
          summary: summary,
          title: title,
          emotion: emotion
        })
        .eq("id", memoryId);
        
    } catch (error) {
      console.error("AI processing failed:", error);
      // Update with fallback values
      await supabase
        .from("memories")
        .update({ 
          summary: "Summary generation failed",
          title: "Memory",
          emotion: "neutral"
        })
        .eq("id", memoryId);
    }
  };

  const generateSummary = async (text: string): Promise<string> => {
    try {
      // Using a free LLM API (Cohere's free tier)
      const response = await fetch(
        "https://api.cohere.ai/v1/summarize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.EXPO_PUBLIC_COHERE_API_KEY || 'demo'}`,
          },
          body: JSON.stringify({
            text: text,
            length: "medium",
            format: "paragraph",
            model: "summarize-xlarge",
            additional_command: "Summarize this transcript in a clear and concise way."
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.summary || "Summary generation failed";
    } catch (error) {
      console.error("Summary generation error:", error);
      
      // Fallback: try using Hugging Face's free inference API
      try {
        const hfResponse = await fetch(
          "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: text.substring(0, 1000), // Limit text length for free API
            }),
          }
        );

        if (hfResponse.ok) {
          const hfResult = await hfResponse.json();
          return hfResult[0]?.summary_text || "Summary generated from transcript";
        }
      } catch (hfError) {
        console.error("Hugging Face fallback failed:", hfError);
      }
      
      // Final fallback: create a simple summary
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      if (sentences.length > 0) {
        return sentences[0] + (sentences.length > 1 ? '. ' + sentences[1] : '') + '.';
      }
      
      return "Summary generated from transcript";
    }
  };

  const generateTitle = async (summary: string): Promise<string> => {
    try {
      // Generate date-based title
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleDateString('en-US', { month: 'long' });
      const year = now.getFullYear();
      
      // Add ordinal suffix to day
      const getOrdinalSuffix = (day: number) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      
      const ordinalDay = day + getOrdinalSuffix(day);
      return `${ordinalDay} ${month}, ${year}`;
    } catch (error) {
      console.error("Title generation error:", error);
      // Fallback to simple date
      const now = new Date();
      return now.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
  };

  const detectEmotion = async (text: string): Promise<string> => {
    try {
      // Enhanced keyword-based emotion detection
      const lowerText = text.toLowerCase();
      
      // Define emotion keywords with weights
      const emotionKeywords = {
        happy: ['happy', 'joy', 'great', 'wonderful', 'amazing', 'excellent', 'fantastic', 'love', 'loved', 'enjoy', 'enjoyed', 'fun', 'excited', 'thrilled', 'delighted', 'pleased', 'satisfied', 'content', 'blessed', 'grateful'],
        sad: ['sad', 'depressed', 'unhappy', 'miserable', 'lonely', 'heartbroken', 'disappointed', 'upset', 'crying', 'tears', 'miss', 'missed', 'lost', 'grief', 'sorrow', 'pain', 'hurt', 'broken'],
        angry: ['angry', 'mad', 'furious', 'rage', 'hate', 'hated', 'annoyed', 'irritated', 'frustrated', 'pissed', 'outraged', 'livid', 'fuming', 'seething', 'bitter', 'resentful'],
        anxious: ['anxious', 'worried', 'nervous', 'scared', 'afraid', 'fear', 'fearful', 'terrified', 'panic', 'stress', 'stressed', 'overwhelmed', 'concerned', 'uneasy', 'tense', 'jittery', 'paranoid'],
        excited: ['excited', 'amazing', 'wow', 'incredible', 'unbelievable', 'stunning', 'mind-blowing', 'awesome', 'spectacular', 'phenomenal', 'extraordinary', 'outstanding', 'brilliant', 'genius']
      };
      
      // Count emotion keywords
      const emotionScores: { [key: string]: number } = {
        happy: 0,
        sad: 0,
        angry: 0,
        anxious: 0,
        excited: 0,
        neutral: 0
      };
      
      // Score each emotion
      Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
        keywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = lowerText.match(regex);
          if (matches) {
            emotionScores[emotion] += matches.length;
          }
        });
      });
      
      // Find the emotion with the highest score
      let maxScore = 0;
      let detectedEmotion = 'neutral';
      
      Object.entries(emotionScores).forEach(([emotion, score]) => {
        if (score > maxScore) {
          maxScore = score;
          detectedEmotion = emotion;
        }
      });
      
      // If no strong emotion detected, check for context clues
      if (maxScore === 0) {
        if (lowerText.includes('work') || lowerText.includes('job') || lowerText.includes('busy')) {
          detectedEmotion = 'neutral';
        } else if (lowerText.includes('family') || lowerText.includes('friend') || lowerText.includes('home')) {
          detectedEmotion = 'happy';
        }
      }
      
      return detectedEmotion;
    } catch (error) {
      console.error("Emotion detection error:", error);
      return "neutral";
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
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptTitle}>Transcript:</Text>
            <TouchableOpacity
              style={styles.minimizeButton}
              onPress={() => setShowTranscript(!showTranscript)}
            >
              <MaterialCommunityIcons
                name={showTranscript ? "chevron-up" : "chevron-down"}
                size={24}
                color="#6200ee"
              />
            </TouchableOpacity>
          </View>
          
          {showTranscript && (
            <ScrollView 
              style={styles.transcriptScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <Text style={styles.transcriptText}>{transcript}</Text>
            </ScrollView>
          )}
          
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
  transcriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
  },
  minimizeButton: {
    padding: 5,
  },
  transcriptScrollView: {
    width: "100%",
    maxHeight: 200, // Adjust as needed for scrollable height
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
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
