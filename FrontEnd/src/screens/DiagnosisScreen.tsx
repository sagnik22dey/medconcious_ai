import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { DiagnosisReport } from '../types';

const DiagnosisScreen = () => {
  const [diagnosisReport, setDiagnosisReport] = useState<DiagnosisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiagnosisReport = async () => {
      try {
        const response = await axios.post<DiagnosisReport>('http://192.168.29.226:8000/generate_diagnosis');
        setDiagnosisReport(response.data);
      } catch (err) {
        setError('Failed to fetch diagnosis report.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiagnosisReport();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading Diagnosis Report...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Diagnosis Report</Text>
      {diagnosisReport ? (
        <View style={styles.reportContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <Text>Name: {diagnosisReport.patientInfo.name}</Text>
            <Text>Age: {diagnosisReport.patientInfo.age}</Text>
            <Text>Gender: {diagnosisReport.patientInfo.gender}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Symptoms</Text>
            {diagnosisReport.symptoms.map((symptom, index) => (
              <Text key={index} style={styles.listItem}>- {symptom}</Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diagnosis</Text>
            <Text style={styles.diagnosisText}>{diagnosisReport.diagnosis}</Text>
            <Text>Confidence: {(diagnosisReport.confidence * 100).toFixed(2)}%</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {diagnosisReport.recommendations.map((rec, index) => (
              <Text key={index} style={styles.listItem}>- {rec}</Text>
            ))}
          </View>
        </View>
      ) : (
        <Text>No diagnosis report available.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#343a40',
  },
  reportContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#495057',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    paddingBottom: 5,
    marginBottom: 10,
  },
  listItem: {
    fontSize: 16,
    marginLeft: 10,
    color: '#6c757d',
  },
  diagnosisText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 5,
  },
});

export default DiagnosisScreen;