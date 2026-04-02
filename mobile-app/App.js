import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, SafeAreaView, StatusBar, TextInput, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const [url, setUrl] = useState('http://localhost:3377'); // Local Vite Port
  const [showInput, setShowInput] = useState(true);
  const [loading, setLoading] = useState(false);

  // Note: For real phone, you MUST use your local IP (e.g., http://192.168.1.100:3377)
  const handleConnect = () => {
    setShowInput(false);
    setLoading(true);
  };

  if (showInput) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <Text style={styles.header}>ESTÚDIO <Text style={{color: '#D97706'}}>ALÊ</Text></Text>
          <Text style={styles.label}>OPERATIONAL IP ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.x.x:3377"
            placeholderTextColor="#666"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.button} onPress={handleConnect}>
            <Text style={styles.buttonText}>ESTABLISH CONNECTION</Text>
          </TouchableOpacity>
          <Text style={styles.footer}>Estúdio Alê • Command Terminal v1.0</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <WebView 
        source={{ uri: url }} 
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loaderText}>LOADING PROTOCOLS...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDFB',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFDFB',
  },
  loginCard: {
    flex: 1,
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
    marginBottom: 40,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 4,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  input: {
    width: '100%',
    backgroundColor: '#FFF',
    borderColor: '#FCE7F3',
    borderWidth: 2,
    borderRadius: 24,
    padding: 20,
    color: '#0F172A',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    backgroundColor: '#F472B6',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFDFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#F472B6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 20,
  }
});
