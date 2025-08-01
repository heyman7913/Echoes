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
import {
  Swipeable,
  RectButton,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

interface Memory {
  id: string;
  created_at: string;
  transcript: string;
  summary?: string;
  user_id: string;
}

export default function MemoriesScreen() {
  const [transcripts, setTranscripts] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /** Fetch all memories for the current signed-in user */
  const fetchTranscripts = useCallback(async () => {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

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

  /** Run once when the screen mounts */
  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  /** Pull-to-refresh handler */
  const onRefresh = () => {
    setRefreshing(true);
    fetchTranscripts();
  };

  /** Delete a memory both remotely and locally */
  const handleDelete = async (id: string) => {
    await supabase.from("memories").delete().eq("id", id);
    setTranscripts((prev) => prev.filter((m) => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  /** Swipe-right delete button */
  const renderRightActions = (id: string) => (
    <RectButton style={styles.deleteButton} onPress={() => handleDelete(id)}>
      <IconButton
        icon="delete"
        size={28}
        iconColor="#fff"
        style={styles.deleteIcon}
      />
    </RectButton>
  );

  /* ---------- render ---------- */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.pageContainer}>
        {/* Header */}
        <View style={styles.headerWrapper}>
          <Text style={styles.pageTitle}>Your Memories</Text>
          <View style={styles.headerLine} />
        </View>

        {/* List */}
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
                <Swipeable
                  key={t.id}
                  renderRightActions={() => renderRightActions(t.id)}
                  overshootRight={false}
                  friction={1.5}
                  animationOptions={{ duration: 320 }}
                >
                  <View style={styles.memoryContainer}>
                    {/* Collapsed row */}
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

                    {/* Expanded details */}
                    {expandedId === t.id && (
                      <View style={styles.expandedBox}>
                        <IconButton
                          icon="close"
                          size={20}
                          style={styles.closeIcon}
                          onPress={() => setExpandedId(null)}
                        />
                        <Text style={styles.transcriptTitle}>Transcript</Text>
                        <Text style={styles.transcriptText}>
                          {t.transcript}
                        </Text>

                        <Text style={styles.summaryTitle}>Summary</Text>
                        <Text style={styles.summaryText}>
                          {/* Replace with real summary when you add it */}
                          AI summary will appear here.
                        </Text>
                      </View>
                    )}

                    {/* Gap between cards */}
                    {idx < transcripts.length - 1 && (
                      <View style={styles.memoryDivider} />
                    )}
                  </View>
                </Swipeable>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 40,
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
    marginBottom: 8,
  },
  headerLine: {
    height: 1,
    backgroundColor: "#e0e0e0",
    width: "100%",
    marginBottom: 16,
  },
  scrollContainer: {
    paddingBottom: 32,
    alignItems: "center",
  },
  centeredList: {
    width: "100%",
    maxWidth: 500,
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
    elevation: 2,
    borderWidth: 1,
    borderColor: "#ececec",
    overflow: "hidden",
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
    color: "#222",
    flex: 1,
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
    fontSize: 14,
    lineHeight: 20,
    color: "#444",
  },
  summaryTitle: {
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 15,
    color: "#333",
  },
  summaryText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#666",
    marginBottom: 8,
  },
  memoryDivider: {
    height: 12,
  },
  deleteButton: {
    backgroundColor: "#ff5252",
    justifyContent: "center",
    alignItems: "center",
    height: "83%",
    paddingHorizontal: 6,
    borderRadius: 10,
    marginRight: 10,
    elevation: 3,
  },
  deleteIcon: {
    margin: 0,
  },
});
