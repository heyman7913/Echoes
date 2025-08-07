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
      console.log("🔍 Generating embedding for text:", text);
      
      const geminiApiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
      
      if (!geminiApiKey) {
        console.error("❌ Gemini API key is not set in environment variables.");
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
        console.log("✅ Generated embedding successfully");
        console.log("📊 Embedding dimensions:", embedding.length);
        console.log("📈 First 10 values:", embedding.slice(0, 10));
        console.log("📉 Last 10 values:", embedding.slice(-10));
        console.log("🔢 Embedding range - Min:", Math.min(...embedding), "Max:", Math.max(...embedding));
        return embedding;
      } else {
        console.error("❌ Failed to generate embedding:", data);
        return null;
      }
    } catch (error) {
      console.error("💥 Error generating embedding:", error);
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
      console.log("📊 Fetched memories from database:", data.length);
      
      // Process and normalize embeddings
      const processedMemories = data.map(memory => {
        if (memory.embedding) {
          console.log("🔍 Raw embedding type:", typeof memory.embedding);
          console.log("🔍 Raw embedding is array:", Array.isArray(memory.embedding));
          
          let normalizedEmbedding = null;
          
          // Handle different embedding formats from database
          if (Array.isArray(memory.embedding)) {
            // Already an array - check if it's the right dimension
            if (memory.embedding.length === 768) {
              normalizedEmbedding = memory.embedding;
              console.log("✅ Embedding already correct format (768 dimensions)");
            } else {
              console.log("⚠️ Embedding array has wrong dimensions:", memory.embedding.length);
              // Try to extract the first 768 values if it's larger
              if (memory.embedding.length > 768) {
                normalizedEmbedding = memory.embedding.slice(0, 768);
                console.log("🔧 Truncated embedding to 768 dimensions");
              }
            }
          } else if (typeof memory.embedding === 'string') {
            // Try to parse JSON string
            try {
              const parsed = JSON.parse(memory.embedding);
              if (Array.isArray(parsed) && parsed.length === 768) {
                normalizedEmbedding = parsed;
                console.log("✅ Parsed embedding from JSON string");
              }
            } catch (e) {
              console.log("❌ Failed to parse embedding JSON:", e);
            }
          } else if (typeof memory.embedding === 'object' && memory.embedding.values) {
            // Handle Google Gemini embedding format
            if (Array.isArray(memory.embedding.values) && memory.embedding.values.length === 768) {
              normalizedEmbedding = memory.embedding.values;
              console.log("✅ Extracted embedding from values property");
            }
          }
          
          return {
            ...memory,
            embedding: normalizedEmbedding
          };
        }
        return memory;
      });
      
      // Debug first processed memory
      if (processedMemories.length > 0 && processedMemories[0].embedding) {
        console.log("🔍 Processed embedding length:", processedMemories[0].embedding.length);
        console.log("🔍 Processed embedding sample:", processedMemories[0].embedding.slice(0, 5));
      }
      
      setMemories(processedMemories as Memory[]);
    } else {
      console.error("❌ Error fetching memories:", error);
    }
    setLoading(false);
  }, []);

  /** Calculate cosine similarity between two vectors */
  const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    console.log("🧮 Calculating cosine similarity");
    console.log("📏 Query vector length:", vecA?.length, "Memory vector length:", vecB?.length);
    
    // Ensure both are valid arrays
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
      console.log("❌ One or both vectors are not arrays");
      return 0;
    }
    
    // Ensure both have same dimensions (should be 768 for text-embedding-004)
    if (vecA.length !== vecB.length) {
      console.log("❌ Vector length mismatch! Query:", vecA.length, "Memory:", vecB.length);
      console.log("🔍 Expected dimension for text-embedding-004: 768");
      return 0;
    }
    
    // Ensure all elements are numbers
    const queryAllNumbers = vecA.every(val => typeof val === 'number' && !isNaN(val));
    const memoryAllNumbers = vecB.every(val => typeof val === 'number' && !isNaN(val));
    
    if (!queryAllNumbers || !memoryAllNumbers) {
      console.log("❌ Vectors contain non-numeric values");
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
      console.log("❌ One of the vectors has zero magnitude!");
      return 0;
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    console.log("🎯 Calculated similarity:", similarity.toFixed(4));
    
    return similarity;
  };

  /** Perform semantic search using embeddings */
  const performSemanticSearch = (queryEmbedding: number[], memories: Memory[]): MemoryWithSimilarity[] => {
    console.log("🔎 Starting semantic search");
    console.log("🧠 Query embedding dimensions:", queryEmbedding.length);
    console.log("💾 Total memories to search:", memories.length);
    
    const memoriesWithValidEmbeddings = memories.filter(memory => {
      const hasValidEmbedding = memory.embedding && 
                               Array.isArray(memory.embedding) && 
                               memory.embedding.length === 768 && 
                               memory.embedding.every(val => typeof val === 'number');
      
      if (!hasValidEmbedding && memory.embedding) {
        console.log("⚠️ Memory has invalid embedding:", {
          id: memory.id,
          embeddingType: typeof memory.embedding,
          isArray: Array.isArray(memory.embedding),
          length: Array.isArray(memory.embedding) ? memory.embedding.length : 'N/A'
        });
      }
      
      return hasValidEmbedding;
    });
    
    console.log("✅ Memories with valid 768-dim embeddings:", memoriesWithValidEmbeddings.length);
    
    if (memoriesWithValidEmbeddings.length === 0) {
      console.log("❌ No memories with valid embeddings found");
      return [];
    }

    const results = memoriesWithValidEmbeddings
      .map((memory, index) => {
        console.log(`\n🔍 Processing memory ${index + 1}/${memoriesWithValidEmbeddings.length}`);
        console.log("📝 Memory text preview:", memory.transcript.substring(0, 100) + "...");
        
        const similarity = cosineSimilarity(queryEmbedding, memory.embedding!);
        console.log("🎯 Final similarity:", similarity);
        
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

    console.log("\n📋 Final results summary:");
    results.forEach((result, index) => {
      console.log(`${index + 1}. Similarity: ${Math.round(result.similarity * 100)}% - "${result.transcript.substring(0, 50)}..."`);
    });

    return results;
  };

  /** Perform vector-based search */
  const performSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Error", "Please enter a search query");
      return;
    }

    console.log("\n🚀 Starting search process");
    console.log("🔍 Search query:", searchQuery);

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

      console.log("🧠 Query embedding generated successfully");
      
      // Filter memories that have embeddings
      const memoriesWithEmbeddings = memories.filter(memory => 
        memory.embedding && memory.embedding.length > 0
      );

      console.log("📊 Search context:");
      console.log("- Total memories:", memories.length);
      console.log("- Memories with embeddings:", memoriesWithEmbeddings.length);

      if (memoriesWithEmbeddings.length === 0) {
        Alert.alert("No searchable memories", "Your memories don't have vector embeddings yet. New memories will be searchable.");
        return;
      }

      const results = performSemanticSearch(queryEmbedding, memoriesWithEmbeddings);
      
      setSearchResults(results);
      
      console.log("\n🎉 Search completed!");
      console.log("📊 Results found:", results.length);
      console.log("🏆 Top result similarity:", results.length > 0 ? Math.round(results[0].similarity * 100) + "%" : "N/A");

    } catch (error) {
      console.error("💥 Search error:", error);
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
  jarContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  jar: {
    width: 240,
    height: 280,
    borderRadius: 120,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  jarContent: {
    flex: 1,
    position: "relative",
    margin: 20,
  },
  emotionOrb: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  jarRim: {
    position: "absolute",
    top: -2,
    left: 20,
    right: 20,
    height: 20,
    backgroundColor: "rgba(200,200,200,0.8)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(150,150,150,0.5)",
  },
  glassReflection: {
    position: "absolute",
    top: 40,
    left: 40,
    width: 80,
    height: 120,
    borderRadius: 40,
  },
  jarLabel: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
  },
  legendContainer: {
    marginTop: 24,
    width: "100%",
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  legendText: {
    fontSize: 12,
    color: "#666",
    textTransform: "capitalize",
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
