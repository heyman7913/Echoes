import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Alert,
} from "react-native";
import { Text, ActivityIndicator, IconButton } from "react-native-paper";
import { supabase } from "../../supabase/client";

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
  embedding?: number[];
}

interface MemoryWithSimilarity extends Memory {
  similarity: number;
}

export default function TherapistScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryWithSimilarity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

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

  /** Generate embedding for search query */
  const generateEmbedding = async (text: string): Promise<number[] | null> => {
    try {
      const geminiApiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
      
      if (!geminiApiKey) {
        return null;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: {
              parts: [{
                text: text
              }]
            }
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.embedding && data.embedding.values) {
        const embedding = data.embedding.values;
        return embedding;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  /** Fetch all memories */
  const fetchMemories = useCallback(async () => {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;

    if (!userId) {
      setMemories([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Process and normalize embeddings
      const processedMemories = data.map(memory => {
        if (memory.embedding) {
          let normalizedEmbedding = null;
          
          // Handle different embedding formats from database
          if (Array.isArray(memory.embedding)) {
            // Already an array - check if it's the right dimension
            if (memory.embedding.length === 768) {
              normalizedEmbedding = memory.embedding;
            } else if (memory.embedding.length > 768) {
              normalizedEmbedding = memory.embedding.slice(0, 768);
            }
          } else if (typeof memory.embedding === 'string') {
            // Try to parse JSON string
            try {
              const parsed = JSON.parse(memory.embedding);
              if (Array.isArray(parsed) && parsed.length === 768) {
                normalizedEmbedding = parsed;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          } else if (typeof memory.embedding === 'object' && memory.embedding.values) {
            // Handle Google Gemini embedding format
            if (Array.isArray(memory.embedding.values) && memory.embedding.values.length === 768) {
              normalizedEmbedding = memory.embedding.values;
            }
          }
          
          return {
            ...memory,
            embedding: normalizedEmbedding
          };
        }
        return memory;
      });
      
      setMemories(processedMemories as Memory[]);
    }
    setLoading(false);
  }, []);

  /** Calculate cosine similarity between two vectors */
  const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    // Ensure both are valid arrays
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
      return 0;
    }
    
    // Ensure both have same dimensions (should be 768 for text-embedding-004)
    if (vecA.length !== vecB.length) {
      return 0;
    }
    
    // Ensure all elements are numbers
    const queryAllNumbers = vecA.every(val => typeof val === 'number' && !isNaN(val));
    const memoryAllNumbers = vecB.every(val => typeof val === 'number' && !isNaN(val));
    
    if (!queryAllNumbers || !memoryAllNumbers) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      const valA = Number(vecA[i]);
      const valB = Number(vecB[i]);
      
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return similarity;
  };

  /** Perform semantic search using embeddings */
  const performSemanticSearch = (queryEmbedding: number[], memories: Memory[]): MemoryWithSimilarity[] => {
    const memoriesWithValidEmbeddings = memories.filter(memory => {
      const hasValidEmbedding = memory.embedding && 
                               Array.isArray(memory.embedding) && 
                               memory.embedding.length === 768 && 
                               memory.embedding.every(val => typeof val === 'number');
      
      return hasValidEmbedding;
    });
    
    if (memoriesWithValidEmbeddings.length === 0) {
      return [];
    }

    const results = memoriesWithValidEmbeddings
      .map((memory) => {
        const similarity = cosineSimilarity(queryEmbedding, memory.embedding!);
        
        return {
          memory,
          similarity
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)
      .map(result => ({ 
        ...result.memory, 
        similarity: result.similarity 
      }));

    return results;
  };

  /** Perform vector-based search */
  const performSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Error", "Please enter a search query");
      return;
    }

    setIsSearching(true);
    
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(searchQuery);
      
      if (!queryEmbedding) {
        Alert.alert("Error", "Failed to process search query. Please check your internet connection and try again.");
        return;
      }
      
      // Filter memories that have embeddings
      const memoriesWithEmbeddings = memories.filter(memory => 
        memory.embedding && memory.embedding.length > 0
      );

      if (memoriesWithEmbeddings.length === 0) {
        Alert.alert("No searchable memories", "Your memories don't have vector embeddings yet. New memories will be searchable.");
        return;
      }

      const results = performSemanticSearch(queryEmbedding, memoriesWithEmbeddings);
      
      setSearchResults(results);

    } catch (error) {
      Alert.alert("Error", "Search failed. Please check your internet connection and try again.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>AI Therapist Assistant</Text>
        <Text style={styles.headerSubtitle}>
          AI-powered semantic search through your memories
        </Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <Text style={styles.sectionTitle}>Semantic Memory Search</Text>
        <Text style={styles.sectionSubtitle}>
          Search through {memories.filter(m => m.embedding && m.embedding.length > 0).length} memories using AI-powered semantic understanding
        </Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Describe what you're looking for... (e.g., 'feeling anxious about work' or 'happy moments with family')"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            multiline={true}
            numberOfLines={3}
            onSubmitEditing={performSearch}
          />
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={performSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <IconButton icon="magnify" size={24} iconColor="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              Showing {searchResults.length} most similar memories (ranked by relevance)
            </Text>
            {searchResults.map((result, index) => (
              <View key={result.id} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>
                    {result.title || "Memory"}
                  </Text>
                  <View style={styles.resultMeta}>
                    <Text style={[styles.similarityScore, {
                      backgroundColor: result.similarity > 0.7 ? "rgba(76, 175, 80, 0.1)" : 
                                     result.similarity > 0.4 ? "rgba(255, 152, 0, 0.1)" : 
                                     "rgba(244, 67, 54, 0.1)",
                      color: result.similarity > 0.7 ? "#4CAF50" : 
                             result.similarity > 0.4 ? "#FF9800" : 
                             "#F44336"
                    }]}>
                      {Math.round(result.similarity * 100)}% similar
                    </Text>
                    <View style={[
                      styles.resultEmotion,
                      { backgroundColor: getEmotionColor(result.emotion || 'neutral') }
                    ]}>
                      <Text style={styles.resultEmotionText}>
                        {result.emotion || 'neutral'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.resultDate}>
                  {new Date(result.created_at).toLocaleDateString()} • {result.day_of_week}
                </Text>
                <Text style={styles.resultText} numberOfLines={4}>
                  {result.transcript}
                </Text>
                {result.duration && (
                  <Text style={styles.resultDuration}>
                    Duration: {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, '0')}
                  </Text>
                )}
              </View>
            ))}
            
            <View style={styles.searchExplanation}>
              <Text style={styles.explanationTitle}>How it works:</Text>
              <Text style={styles.explanationText}>
                • AI converts your search into a vector representation{'\n'}
                • Compares against all memory vectors using cosine similarity{'\n'}
                • Results ranked by semantic similarity, not exact word matching{'\n'}
                • Higher percentages = more conceptually similar content
              </Text>
            </View>
          </View>
        )}

        {/* No searchable memories message */}
        {memories.length > 0 && memories.filter(m => m.embedding && m.embedding.length > 0).length === 0 && (
          <View style={styles.noMemoriesContainer}>
            <Text style={styles.noMemoriesTitle}>No Searchable Memories</Text>
            <Text style={styles.noMemoriesText}>
              Your existing memories need to be processed for semantic search. New memories will be automatically searchable.
            </Text>
          </View>
        )}

        {/* No memories at all */}
        {memories.length === 0 && (
          <View style={styles.noMemoriesContainer}>
            <Text style={styles.noMemoriesTitle}>No Memories Yet</Text>
            <Text style={styles.noMemoriesText}>
              Start recording your thoughts and memories to use the AI-powered search feature.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#6200ee",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 22,
  },
  searchSection: {
    padding: 24,
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 16,
    elevation: 2,
    minHeight: 400,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    maxHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#f8f9fa",
  },
  searchButton: {
    backgroundColor: "#6200ee",
    borderRadius: 12,
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  resultsContainer: {
    marginTop: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#6200ee",
    elevation: 1,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  resultMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  similarityScore: {
    fontSize: 11,
    color: "#6200ee",
    fontWeight: "bold",
    backgroundColor: "rgba(98, 0, 238, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  resultEmotion: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultEmotionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  resultDate: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
    marginBottom: 8,
  },
  resultDuration: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  noMemoriesContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noMemoriesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  noMemoriesText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  searchExplanation: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6200ee",
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
});
