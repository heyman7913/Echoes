import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text, ActivityIndicator, IconButton, Card } from "react-native-paper";
import { supabase } from "../../supabase/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  embedding?: number[];
}

interface MemoryWithSimilarity extends Memory {
  similarity: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relevantMemories?: MemoryWithSimilarity[];
}

export default function TherapistScreen() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMemoryDetails, setShowMemoryDetails] = useState<{[key: string]: boolean}>({});
  
  const scrollViewRef = useRef<ScrollView>(null);
  const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "");
  const { currentTheme } = useTheme();

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
      .slice(0, 5) // Get top 5 most relevant memories for context
      .filter(result => result.similarity > 0.3) // Only include memories with reasonable similarity
      .map(result => ({ 
        ...result.memory, 
        similarity: result.similarity 
      }));

    return results;
  };

  /** Get relevant memories for the user's message */
  const getRelevantMemories = async (userMessage: string): Promise<MemoryWithSimilarity[]> => {
    try {
      const queryEmbedding = await generateEmbedding(userMessage);
      
      if (!queryEmbedding) {
        return [];
      }
      
      const memoriesWithEmbeddings = memories.filter(memory => 
        memory.embedding && memory.embedding.length > 0
      );

      if (memoriesWithEmbeddings.length === 0) {
        return [];
      }

      const results = performSemanticSearch(queryEmbedding, memoriesWithEmbeddings);
      return results;
    } catch (error) {
      console.error("Error getting relevant memories:", error);
      return [];
    }
  };

  /** Generate therapist response using Gemini with RAG and conversation context */
  const generateTherapistResponse = async (userMessage: string, relevantMemories: MemoryWithSimilarity[]): Promise<string> => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Build context from relevant memories
      let memoryContext = "";
      if (relevantMemories.length > 0) {
        memoryContext = "Relevant past memories:\n";
        relevantMemories.forEach((memory, index) => {
          memoryContext += `${new Date(memory.created_at).toLocaleDateString()}: ${memory.transcript}\n`;
          if (memory.summary) {
            memoryContext += `(${memory.summary})\n`;
          }
          memoryContext += "\n";
        });
      }

      // Build conversation history for context
      const recentMessages = chatMessages.slice(-6); // Last 6 messages for context
      let conversationHistory = "";
      if (recentMessages.length > 0) {
        conversationHistory = "Recent conversation:\n";
        recentMessages.forEach((msg) => {
          conversationHistory += `${msg.role === 'user' ? 'User' : 'You'}: ${msg.content}\n`;
        });
        conversationHistory += "\n";
      }

      const systemPrompt = `You are an experienced therapist having a natural conversation. You remember what's been discussed and build on it organically.

${memoryContext}${conversationHistory}

Be genuinely human in your responses - no rigid formats or clinical templates. Respond as you would in person: sometimes with just empathy, sometimes with insights, sometimes with gentle questions. Let the conversation flow naturally.

Key principles:
- Remember and reference what we've already talked about
- Speak naturally, not like a chatbot following a script
- Only give advice when it feels right, not because you think you should
- Ask questions because you're genuinely curious, not to fill a template - but do not overdo it
- Wherever needed, help the user process and reflect on their feelings
- Sometimes just listening and reflecting is enough
- Be real about the therapeutic relationship - you care, but you're not their friend
- Vary your response style - don't always end with questions

Trust your therapeutic instincts and respond authentically to what they're sharing.`;

      // Build the full conversation context for Gemini
      const conversationContents = [
        {
          role: "user",
          parts: [{ text: systemPrompt }]
        }
      ];

      // Add recent conversation history to the model context
      recentMessages.forEach((msg) => {
        conversationContents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });

      // Add current message
      conversationContents.push({
        role: "user",
        parts: [{ text: userMessage }]
      });

      const result = await model.generateContent({
        contents: conversationContents,
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating response:", error);
      return "I'm having some technical difficulties right now. Can we try that again in a moment?";
    }
  };

  /** Handle sending a message */
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsProcessing(true);

    try {
      // Get relevant memories for RAG
      const relevantMemories = await getRelevantMemories(userMessage.content);
      
      // Generate therapist response
      const response = await generateTherapistResponse(userMessage.content, relevantMemories);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        relevantMemories: relevantMemories.length > 0 ? relevantMemories : undefined
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error in chat:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error while processing your message. Please try again.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  /** Format time */
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /** Toggle memory details visibility */
  const toggleMemoryDetails = (messageId: string) => {
    setShowMemoryDetails(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading your memories...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: currentTheme.colors.background }]} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.headerSection, { backgroundColor: currentTheme.colors.primary }]}>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.onPrimary }]}>AI Therapist</Text>
        {/* Removed context count subtitle */}
      </View>

      {/* Chat Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={[styles.chatContainer, { backgroundColor: currentTheme.colors.background }]}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {chatMessages.length === 0 ? (
          <View style={[styles.welcomeContainer, { backgroundColor: currentTheme.colors.card }]}>
            <Text style={[styles.welcomeTitle, { color: currentTheme.colors.text }]}>Welcome to your AI Therapist</Text>
            <Text style={[styles.welcomeText, { color: currentTheme.colors.textSecondary }]}>
              I'm here to provide emotional support and guidance. I have access to your memories to offer personalized insights. How are you feeling today?
            </Text>
          </View>
        ) : (
          chatMessages.map((message) => (
            <View key={message.id} style={styles.messageWrapper}>
              <View style={[
                styles.messageBubble,
                message.role === 'user' 
                  ? [styles.userMessage, { backgroundColor: currentTheme.colors.primary }]
                  : [styles.assistantMessage, { backgroundColor: currentTheme.colors.card }]
              ]}>
                <Text style={[
                  styles.messageText,
                  message.role === 'user' 
                    ? [styles.userMessageText, { color: currentTheme.colors.onPrimary }]
                    : [styles.assistantMessageText, { color: currentTheme.colors.text }]
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.role === 'user' 
                    ? [styles.userMessageTime, { color: currentTheme.colors.onPrimary + '99' }]
                    : [styles.assistantMessageTime, { color: currentTheme.colors.textSecondary }]
                ]}>
                  {formatTime(message.timestamp)}
                </Text>
              </View>

              {/* Show relevant memories for assistant messages */}
              {message.role === 'assistant' && message.relevantMemories && message.relevantMemories.length > 0 && (
                <View style={styles.memoriesSection}>
                  <TouchableOpacity 
                    style={[styles.memoriesHeader, { backgroundColor: currentTheme.colors.primary + '0D' }]}
                    onPress={() => toggleMemoryDetails(message.id)}
                  >
                    <Text style={[styles.memoriesTitle, { color: currentTheme.colors.primary }]}>
                      Referenced {message.relevantMemories.length} relevant memories
                    </Text>
                    <IconButton 
                      icon={showMemoryDetails[message.id] ? "chevron-up" : "chevron-down"} 
                      size={20}
                      iconColor={currentTheme.colors.primary}
                    />
                  </TouchableOpacity>

                  {showMemoryDetails[message.id] && (
                    <View style={styles.memoriesDetails}>
                      {message.relevantMemories.map((memory, index) => (
                        <Card key={memory.id} style={[styles.memoryCard, { backgroundColor: currentTheme.colors.surfaceVariant }]}>
                          <Card.Content style={styles.memoryCardContent}>
                            <View style={styles.memoryHeader}>
                              <Text style={[styles.memoryTitle, { color: currentTheme.colors.text }]}>
                                {memory.title || `Memory ${index + 1}`}
                              </Text>
                              <View style={styles.memoryMeta}>
                                <Text style={[styles.similarityBadge, { 
                                  backgroundColor: currentTheme.colors.primary + '1A',
                                  color: currentTheme.colors.primary 
                                }]}>
                                  {Math.round(memory.similarity * 100)}% match
                                </Text>
                                <View style={[
                                  styles.emotionBadge,
                                  { backgroundColor: getEmotionColor(memory.emotion || 'neutral') }
                                ]}>
                                  <Text style={styles.emotionBadgeText}>
                                    {memory.emotion || 'neutral'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <Text style={[styles.memoryDate, { color: currentTheme.colors.textSecondary }]}>
                              {new Date(memory.created_at).toLocaleDateString()} • {memory.day_of_week}
                            </Text>
                            <Text style={[styles.memoryText, { color: currentTheme.colors.text }]} numberOfLines={3}>
                              {memory.transcript}
                            </Text>
                          </Card.Content>
                        </Card>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <View style={styles.processingContainer}>
            <View style={[styles.processingBubble, { backgroundColor: currentTheme.colors.card }]}>
              <ActivityIndicator size="small" color={currentTheme.colors.textSecondary} />
              <Text style={[styles.processingText, { color: currentTheme.colors.textSecondary }]}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Section */}
      <View style={[styles.inputSection, { backgroundColor: currentTheme.colors.card, borderTopColor: currentTheme.colors.border }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.messageInput, { 
              borderColor: currentTheme.colors.border, 
              backgroundColor: currentTheme.colors.surfaceVariant,
              color: currentTheme.colors.text
            }]}
            placeholder="Share what's on your mind..."
            placeholderTextColor={currentTheme.colors.textSecondary}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline={true}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity 
            style={[styles.sendButton, { 
              backgroundColor: currentTheme.colors.primary,
              opacity: inputMessage.trim() ? 1 : 0.5 
            }]}
            onPress={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
          >
            <IconButton icon="send" size={24} iconColor={currentTheme.colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    padding: 20,
  },
  headerSection: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#6200ee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  chatContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  welcomeContainer: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    textAlign: "center",
  },
  messageWrapper: {
    marginBottom: 16,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
    elevation: 1,
  },
  userMessage: {
    backgroundColor: "#6200ee",
    alignSelf: "flex-end",
    marginLeft: "20%",
  },
  assistantMessage: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    marginRight: "20%",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: "#fff",
  },
  assistantMessageText: {
    color: "#333",
  },
  messageTime: {
    fontSize: 12,
    marginTop: 6,
  },
  userMessageTime: {
    color: "rgba(255,255,255,0.7)",
  },
  assistantMessageTime: {
    color: "#888",
  },
  memoriesSection: {
    marginTop: 8,
    marginRight: "20%",
  },
  memoriesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(98, 0, 238, 0.05)",
    padding: 8,
    borderRadius: 8,
  },
  memoriesTitle: {
    fontSize: 14,
    color: "#6200ee",
    fontWeight: "500",
  },
  memoriesDetails: {
    marginTop: 4,
  },
  memoryCard: {
    marginBottom: 6,
    backgroundColor: "#f8f9fa",
    elevation: 1,
  },
  memoryCardContent: {
    padding: 12,
  },
  memoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  memoryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  memoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  similarityBadge: {
    fontSize: 10,
    color: "#6200ee",
    backgroundColor: "rgba(98, 0, 238, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: "bold",
  },
  emotionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emotionBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  memoryDate: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  memoryText: {
    fontSize: 12,
    color: "#444",
    lineHeight: 18,
  },
  processingContainer: {
    alignItems: "flex-start",
    marginBottom: 16,
  },
  processingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 18,
    elevation: 1,
    maxWidth: "80%",
    marginRight: "20%",
  },
  processingText: {
    fontSize: 16,
    color: "#666",
    marginLeft: 8,
    fontStyle: "italic",
  },
  inputSection: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: "#f8f9fa",
  },
  sendButton: {
    backgroundColor: "#6200ee",
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
});
