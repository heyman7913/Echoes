import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Dimensions,
} from "react-native";
import { Text, IconButton, ActivityIndicator } from "react-native-paper";
import { supabase } from "../../supabase/client";
import {
  Swipeable,
  RectButton,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useTheme } from "../../contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

interface Memory {
  id: string;
  created_at: string;
  transcript: string;
  summary?: string;
  title?: string;
  emotion?: string;
  duration?: number;
  day_of_week?: string;
  user_id: string;
}

export default function MemoriesScreen() {
  const [transcripts, setTranscripts] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const { currentTheme } = useTheme();

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
    if (selectedMemory?.id === id) {
      setModalVisible(false);
      setSelectedMemory(null);
    }
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

  /** Format duration from seconds to MM:SS */
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /** Get emotion color */
  const getEmotionColor = (emotion: string) => {
    const colors = {
      happy: '#4CAF50',
      excited: '#FF9800',
      sad: '#2196F3',
      angry: '#F44336',
      anxious: '#9C27B0',
      neutral: '#9E9E9E'
    };
    return colors[emotion as keyof typeof colors] || colors.neutral;
  };

  /** Get emotion icon */
  const getEmotionIcon = (emotion: string) => {
    const icons = {
      happy: '😊',
      excited: '🎉',
      sad: '😢',
      angry: '😠',
      anxious: '😰',
      neutral: '😐'
    };
    return icons[emotion as keyof typeof icons] || icons.neutral;
  };

  /** Open memory modal */
  const openMemoryModal = async (memory: Memory) => {
    setSelectedMemory(memory);
    setModalVisible(true);
  };

  /** Close memory modal */
  const closeMemoryModal = () => {
    setModalVisible(false);
    setSelectedMemory(null);
  };

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
      <View style={[styles.pageContainer, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.headerWrapper, { backgroundColor: currentTheme.colors.primary }]}>
          <Text style={[styles.pageTitle, { color: currentTheme.colors.onPrimary }]}>Your Memories</Text>
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
                <Text variant="headlineMedium" style={{ color: currentTheme.colors.text }}>Memories</Text>
                <Text style={{ color: currentTheme.colors.textSecondary }}>Your saved memories will appear here.</Text>
              </View>
            ) : (
              transcripts.map((memory, idx) => (
                <Swipeable
                  key={memory.id}
                  renderRightActions={() => renderRightActions(memory.id)}
                  overshootRight={false}
                  friction={1.5}
                  animationOptions={{ duration: 320 }}
                >
                  <TouchableOpacity
                    style={[styles.memoryCard, { 
                      backgroundColor: currentTheme.colors.card, 
                      borderColor: currentTheme.colors.border 
                    }]}
                    onPress={() => openMemoryModal(memory)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.memoryTitle, { color: currentTheme.colors.text }]}>
                          {memory.title || "Memory"}
                        </Text>
                        <View style={[
                          styles.emotionTag,
                          { backgroundColor: getEmotionColor(memory.emotion || 'neutral') }
                        ]}>
                          <Text style={styles.emotionText}>
                            {getEmotionIcon(memory.emotion || 'neutral')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <Text style={[styles.dateText, { color: currentTheme.colors.textSecondary }]}>
                          {new Date(memory.created_at).toLocaleDateString()} • {memory.day_of_week}
                        </Text>
                        {memory.duration && (
                          <Text style={[styles.durationText, { color: currentTheme.colors.textSecondary }]}>
                            {formatDuration(memory.duration)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              ))
            )}
          </View>
        </ScrollView>

        {/* Memory Detail Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={closeMemoryModal}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: currentTheme.colors.card }]}>
              {selectedMemory && (
                <>
                  {/* Modal Header */}
                  <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
                    <View style={styles.modalTitleRow}>
                      <Text style={[styles.modalTitle, { color: currentTheme.colors.text }]}>
                        {selectedMemory.title || "Memory"}
                      </Text>
                      <TouchableOpacity onPress={closeMemoryModal}>
                        <IconButton icon="close" size={24} iconColor={currentTheme.colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalMeta}>
                      <Text style={[styles.modalDate, { color: currentTheme.colors.textSecondary }]}>
                        {new Date(selectedMemory.created_at).toLocaleDateString()} • {selectedMemory.day_of_week}
                      </Text>
                      {selectedMemory.duration && (
                        <Text style={[styles.modalDuration, { color: currentTheme.colors.textSecondary }]}>
                          Duration: {formatDuration(selectedMemory.duration)}
                        </Text>
                      )}
                    </View>

                    <View style={[
                      styles.modalEmotionTag,
                      { backgroundColor: getEmotionColor(selectedMemory.emotion || 'neutral') }
                    ]}>
                      <Text style={styles.modalEmotionText}>
                        {getEmotionIcon(selectedMemory.emotion || 'neutral')} {selectedMemory.emotion || 'neutral'}
                      </Text>
                    </View>
                  </View>

                  {/* Modal Body */}
                  <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Summary</Text>
                      <Text style={[styles.sectionText, { color: currentTheme.colors.textSecondary }]}>
                        {selectedMemory.summary || "No summary available"}
                      </Text>
                    </View>

                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Transcript</Text>
                      <Text style={[styles.sectionText, { color: currentTheme.colors.textSecondary }]}>
                        {selectedMemory.transcript}
                      </Text>
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 8,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
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
  memoryCard: {
    marginBottom: 8,
    borderRadius: 10,
    elevation: 2,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    padding: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  emotionTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  emotionText: {
    fontSize: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 12,
  },
  durationText: {
    fontSize: 12,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderRadius: 10,
    width: "90%",
    maxHeight: "80%",
    elevation: 5,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  modalMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 14,
  },
  modalDuration: {
    fontSize: 14,
  },
  modalEmotionTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  modalEmotionText: {
    fontSize: 16,
  },
  modalBody: {
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
});