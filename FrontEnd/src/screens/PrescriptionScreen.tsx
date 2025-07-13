import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { Prescription } from '../types';

const PrescriptionScreen = () => {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrescription = async () => {
      try {
        const response = await axios.get<Prescription>('http://192.168.29.226:8000/prescription');
        setPrescription(response.data);
      } catch (err) {
        setError('Failed to fetch prescription.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrescription();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading Prescription...</Text>
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
      <Text style={styles.title}>Prescription</Text>
      {prescription ? (
        <View style={styles.prescriptionContainer}>
          <View style={styles.header}>
            <Text style={styles.doctorName}>Dr. {prescription.doctorName}</Text>
            <Text style={styles.date}>{new Date(prescription.date).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.patientName}>Patient: {prescription.patientName}</Text>

          <View style={styles.medicationsContainer}>
            <Text style={styles.subHeader}>Medications</Text>
            {prescription.medications.map((med, index) => (
              <View key={index} style={styles.medicationItem}>
                <Text style={styles.medicationName}>{med.name}</Text>
                <Text>Dosage: {med.dosage}</Text>
                <Text>Frequency: {med.frequency}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text>No prescription available.</Text>
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
  prescriptionContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  doctorName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#495057',
  },
  date: {
    fontSize: 14,
    color: '#6c757d',
  },
  patientName: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 20,
  },
  medicationsContainer: {
    marginTop: 10,
  },
  subHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    color: '#495057',
  },
  medicationItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default PrescriptionScreen;