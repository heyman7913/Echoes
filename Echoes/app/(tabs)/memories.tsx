import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Text, IconButton, ActivityIndicator } from "react-native-paper";
import { supabase } from "../../supabase/client";

interface Memory {
  id: string;
  created_at: string;
  transcript: string;
  summary?: string;
  user_id: string;
}

export default function MemoriesScreen() {
  const [transcripts, setTranscripts] = useState<Memory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      setTranscripts([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) setTranscripts(data as Memory[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTranscripts();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.pageContainer}>
      <View style={styles.headerWrapper}>
        <Text style={styles.pageTitle}>Your Memories</Text>
        <View style={styles.headerLine} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centeredList}>
          {transcripts.length === 0 ? (
            <View style={styles.centered}>
              <Text variant="headlineMedium">Memories</Text>
              <Text>Your saved memories will appear here.</Text>
            </View>
          ) : (
            transcripts.map((t, idx) => (
              <View key={t.id} style={styles.memoryContainer}>
                <TouchableOpacity
                  onPress={() => setExpandedId(t.id)}
                  disabled={expandedId === t.id}
                  style={styles.memoryHeader}
                >
                  <View style={styles.headerRow}>
                    <Text style={styles.heading}>Memory</Text>
                    <Text style={styles.timestamp}>
                      {new Date(t.created_at).toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>

                {expandedId === t.id && (
                  <View style={styles.expandedBox}>
                    <IconButton
                      icon="close"
                      size={20}
                      style={styles.closeIcon}
                      onPress={() => setExpandedId(null)}
                    />
                    <Text style={styles.transcriptTitle}>Transcript</Text>
                    <Text style={styles.transcriptText}>{t.transcript}</Text>
                    <Text style={styles.summaryTitle}>Summary</Text>
                    <Text style={styles.summaryText}>
                      AI summary will appear here.
                    </Text>
                  </View>
                )}
                {/* Divider between memories */}
                {idx < transcripts.length - 1 && (
                  <View style={styles.memoryDivider} />
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 40,
    paddingHorizontal: 0,
  },
  headerWrapper: {
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    textAlign: "left",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerLine: {
    height: 1,
    backgroundColor: "#e0e0e0",
    width: "100%",
    marginBottom: 16,
  },
  scrollContainer: {
    paddingHorizontal: 0,
    paddingBottom: 32,
    alignItems: "center",
  },
  centeredList: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  memoryContainer: {
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    elevation: 2,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#ececec",
  },
  memoryHeader: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heading: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
    color: "#222",
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
    marginLeft: 8,
  },
  expandedBox: {
    backgroundColor: "#f9f9f9",
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#eee",
    position: "relative",
  },
  closeIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    zIndex: 1,
  },
  transcriptTitle: {
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 4,
    fontSize: 15,
    color: "#333",
  },
  transcriptText: {
    marginBottom: 12,
    color: "#444",
    fontSize: 14,
    lineHeight: 20,
  },
  summaryTitle: {
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 15,
    color: "#333",
  },
  summaryText: {
    color: "#666",
    marginBottom: 8,
    fontSize: 13,
    fontStyle: "italic",
  },
  memoryDivider: {
    height: 12,
    backgroundColor: "transparent",
  },
});
