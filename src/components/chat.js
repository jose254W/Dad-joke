import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FaPaperPlane, FaPlus, FaTrash, FaVolumeUp } from "react-icons/fa";
import { styles } from "./styles"; // Assuming styles are imported from a separate file

function Chat() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const inputRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversationIndex, setActiveConversationIndex] = useState(null);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
  
    setLoading(true);
  
    try {
      const activeConversation = conversations[activeConversationIndex];
      const conversationId = activeConversation ? activeConversation._id : null;
  
      const res = await axios.post(
        "http://localhost:5000/api/chat",
        { message, conversationId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      const audioContent = res.data.audioContent; // This is base64

      if (!audioContent) {
        console.error("No audio content received");
        return;
      }

      console.log("Received audio content length:", audioContent.length);

      // Convert base64 to Uint8Array
      const binaryAudio = atob(audioContent);
      const audioArray = new Uint8Array(binaryAudio.length);
      for (let i = 0; i < binaryAudio.length; i++) {
        audioArray[i] = binaryAudio.charCodeAt(i);
      }

      console.log("Converted audio array length:", audioArray.length);

      // Create blob and URL
      const audioBlob = new Blob([audioArray.buffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log("Audio Blob size:", audioBlob.size);
      console.log("Audio URL:", audioUrl);
  
      if (!conversationId) {
        const newConversationTitle = message.length > 30 ? message.substring(0, 30) + "..." : message;
        const newConversation = {
          _id: res.data.conversationId,
          title: newConversationTitle,
          messages: [
            { role: "user", content: message },
            { role: "assistant", content: res.data.response, audioUrl: audioUrl },
          ],
        };
  
        setConversations((prevConversations) => [
          ...prevConversations,
          newConversation,
        ]);
  
        setActiveConversationIndex(conversations.length);
      } else {
        setConversations((prevConversations) => {
          const updatedConversations = [...prevConversations];
          updatedConversations[activeConversationIndex] = {
            ...updatedConversations[activeConversationIndex],
            messages: [
              ...updatedConversations[activeConversationIndex].messages,
              { role: "user", content: message },
              { role: "assistant", content: res.data.response, audioUrl: audioUrl },
            ],
          };
  
          return updatedConversations;
        });
      }
  
      setMessage("");
      inputRef.current.focus();
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5000/api/login", { email, password });
      setToken(res.data.token);
      setIsLoggedIn(true);
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/register", { email, password });
      alert("Sign up successful. Please log in.");
      setIsSignUp(false);
    } catch (error) {
      console.error("Sign up error:", error);
      alert("Sign up failed. Please try again.");
    }
  };

  const handleLogout = () => {
    setToken("");
    setIsLoggedIn(false);
    setConversations([]);
    setActiveConversationIndex(null);
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const fetchedConversations = res.data.map((conv) => ({
        ...conv,
        title: getConversationTitle(conv), 
      }));
      
      setConversations(fetchedConversations);
  
      if (fetchedConversations.length > 0) {
        setActiveConversationIndex(0); 
      } else {
        setActiveConversationIndex(null); 
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };
  
  const getConversationTitle = (conversation) => {
    const firstMessage = conversation.messages.find(msg => msg.role === "user")?.content;
    if (firstMessage) {
      return firstMessage.length > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage;
    }
    return "New Conversation";
  };

  const fetchConversationDetails = async (conversationId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/conversation/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fetchedConversation = res.data;
      const newTitle = getConversationTitle(fetchedConversation);

      setConversations(prevConversations => 
        prevConversations.map(conv => 
          conv._id === conversationId ? { ...fetchedConversation, title: newTitle } : conv
        )
      );
    } catch (error) {
      console.error("Error fetching conversation details:", error);
    }
  };

  const handleDeleteConversation = async (index) => {
    const conversationToDelete = conversations[index];
    if (!conversationToDelete || !conversationToDelete._id) {
      console.error("Invalid conversation or missing ID");
      alert("Unable to delete this conversation. Please try again.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete this conversation?`)) {
      try {
        await axios.delete(`http://localhost:5000/api/conversation/${conversationToDelete._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(prevConversations => prevConversations.filter((_, i) => i !== index));
        if (activeConversationIndex === index) {
          setActiveConversationIndex(null);
        } else if (activeConversationIndex > index) {
          setActiveConversationIndex(prevIndex => prevIndex - 1);
        }
      } catch (error) {
        console.error("Error deleting conversation:", error);
        if (error.response && error.response.status === 404) {
          alert("Conversation not found. It may have been already deleted.");
        } else {
          alert("Failed to delete conversation. Please try again.");
        }
      }
    }
  };

  const startNewConversation = () => {
    setActiveConversationIndex(null);
  };

  const handleConversationSelect = (index) => {
    setActiveConversationIndex(index);
    const selectedConversation = conversations[index];
    if (selectedConversation && selectedConversation._id) {
      fetchConversationDetails(selectedConversation._id);
    }
  };
  
  useEffect(() => {
    if (isLoggedIn) {
      fetchConversations();
    }
  }, [isLoggedIn]);
  
  useEffect(() => {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [conversations, activeConversationIndex]);

  const playAudio = (audioUrl) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    audioRef.current = new Audio(audioUrl);
    
    audioRef.current.onerror = (e) => {
      console.error("Audio playback error:", e);
      console.error("Error code:", audioRef.current.error.code);
      console.error("Error message:", audioRef.current.error.message);
      console.error("Audio source:", audioRef.current.src);
    };

    audioRef.current.onloadedmetadata = () => {
      console.log("Audio metadata loaded successfully");
      console.log("Audio duration:", audioRef.current.duration);
      console.log("Audio type:", audioRef.current.type);
    };

    audioRef.current.play()
      .then(() => {
        console.log("Audio started playing successfully");
        setIsPlaying(true);
      })
      .catch(error => {
        console.error("Error playing audio:", error);
        // Try decoding the audio data
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        fetch(audioUrl)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
          .then(audioBuffer => {
            console.log("Audio decoded successfully");
            // You can play the decoded audio here if needed
          })
          .catch(decodeError => {
            console.error("Error decoding audio:", decodeError);
          });
      });

    audioRef.current.onended = () => {
      console.log("Audio playback ended");
      setIsPlaying(false);
    };
  };

  if (!isLoggedIn) {
    return (
      <div style={styles.container}>
        <h1 style={styles.header}>{isSignUp ? "Sign Up" : "Login"}</h1>
        <form onSubmit={isSignUp ? handleSignUp : handleLogin} style={styles.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={styles.input}
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button}>
            {isSignUp ? "Sign Up" : "Login"}
          </button>
        </form>
        <p style={styles.switchText}>
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <span style={styles.switchLink} onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Login" : "Sign Up"}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.sidebar}>
        <button onClick={startNewConversation} style={styles.newConversationButton}>
          <FaPlus /> New Conversation
        </button>
        {conversations && conversations.length > 0 ? (
          conversations.map((conv, index) => (
            <div
              key={conv._id || index}
              style={{
                ...styles.conversationItem,
                backgroundColor: index === activeConversationIndex ? '#e0e0e0' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div onClick={() => handleConversationSelect(index)}>
                {conv.title || `Conversation ${index + 1}`}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(index);
                }}
                style={styles.deleteButton}
              >
                <FaTrash />
              </button>
            </div>
          ))
        ) : (
          <div style={styles.noConversations}>No conversations yet</div>
        )}
      </div>
      <div style={styles.chatContainer}>
        <h1 style={styles.header}>Dad Jokes Chat Bot</h1>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
        <div id="chatBox" style={{ ...styles.chatBox, height: "400px", overflowY: "auto" }}>
          {activeConversationIndex !== null && 
           conversations[activeConversationIndex] && 
           conversations[activeConversationIndex].messages && 
           conversations[activeConversationIndex].messages.map((chat, index) => (
            <div key={index} style={chat.role === "user" ? styles.userMessage : styles.botMessage}>
              <div dangerouslySetInnerHTML={{ __html: chat.content }} />
              {chat.role === "assistant" && chat.audioUrl && (
                <button 
                  onClick={() => playAudio(chat.audioUrl)} 
                  style={styles.playButton}
                >
                  <FaVolumeUp />
                </button>
              )}
            </div>
          ))}
          {loading && <p style={styles.loading}>Loading...</p>}
        </div>
        <div style={styles.inputContainer}>
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            style={styles.input}
          />
          <button onClick={handleSendMessage} style={styles.sendButton}>
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;