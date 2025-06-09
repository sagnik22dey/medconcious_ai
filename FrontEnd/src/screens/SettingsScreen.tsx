import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcon } from "../components/MaterialIcon";
import { SettingsSection } from "../types";

export function SettingsScreen() {
  const navigation = useNavigation();

  const handleSettingPress = (title: string) => {
    Alert.alert(title, "This feature is coming soon!", [{ text: "OK" }]);
  };

  const settingsSections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        {
          id: "account",
          title: "Account",
          subtitle: "Manage your account details",
          icon: "person-outline",
          onPress: () => handleSettingPress("Account"),
        },
        {
          id: "subscription",
          title: "Subscription",
          subtitle: "Manage your subscription plan",
          icon: "star-border",
          onPress: () => handleSettingPress("Subscription"),
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          id: "appearance",
          title: "Appearance",
          subtitle: "Customize theme and layout",
          icon: "brightness-6",
          onPress: () => handleSettingPress("Appearance"),
        },
        {
          id: "notifications",
          title: "Notifications",
          subtitle: "Manage your notification settings",
          icon: "notifications-none",
          onPress: () => handleSettingPress("Notifications"),
        },
        {
          id: "privacy",
          title: "Privacy",
          subtitle: "Control your privacy settings",
          icon: "security",
          onPress: () => handleSettingPress("Privacy"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          title: "Help",
          subtitle: "Find answers and support",
          icon: "help-outline",
          onPress: () => handleSettingPress("Help"),
        },
        {
          id: "about",
          title: "About",
          subtitle: "Learn more about the app",
          icon: "info-outline",
          onPress: () => handleSettingPress("About"),
        },
      ],
    },
  ];

  const renderSettingsItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingsItem}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsItemLeft}>
        <View style={styles.iconContainer}>
          <MaterialIcon name={item.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <MaterialIcon name="chevron-right" size={20} color="#ababab" />
    </TouchableOpacity>
  );

  const renderSection = (section: SettingsSection) => (
    <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.sectionContent}>
        {section.items.map(renderSettingsItem)}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcon name="arrow-back-ios" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingsSections.map(renderSection)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141414",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 35,
    borderBottomWidth: 1,
    borderBottomColor: "#303030",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionContent: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    overflow: "hidden",
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#303030",
  },
  settingsItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#303030",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 14,
    color: "#ababab",
    lineHeight: 18,
  },
});
