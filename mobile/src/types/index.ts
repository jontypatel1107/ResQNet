export type UserRole = "citizen" | "volunteer" | "admin";

export type VolunteerSkill =
  | "first_aid"
  | "medical"
  | "rescue"
  | "driving"
  | "food_distribution"
  | "general_assistance";

export interface GeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface VolunteerProfile {
  _id?: string;
  userId?: string;
  skills: VolunteerSkill[];
  availability: boolean;
  serviceRadius: number;
  location?: GeoLocation;
  verified?: boolean;
}

export type RelationshipType =
  | "Family"
  | "Parent"
  | "Spouse"
  | "Sibling"
  | "Child"
  | "Friend"
  | "Doctor"
  | "Colleague"
  | "Other";

export interface TrustedContact {
  _id?: string;
  name: string;
  phone: string;
  relationship: RelationshipType;
  notifyOnSOS: boolean;
  notifyVia: ("sms" | "whatsapp" | "call")[];
  createdAt?: string;
}

export interface TrustedCircleSettings {
  autoAlertEnabled: boolean;
  includeLiveLocation: boolean;
  notifyOnCriticalOnly: boolean;
  customAlertMessage: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  profileImage?: string | null;
  isActive?: boolean;
  createdAt?: string;
  volunteerProfile?: VolunteerProfile | null;
  trustedContacts?: TrustedContact[];
  trustedCircleSettings?: TrustedCircleSettings;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "citizen" | "volunteer";
  skills?: string[];
  serviceRadius?: number;
  latitude?: number;
  longitude?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type EmergencyCategory =
  | "medical"
  | "rescue"
  | "food"
  | "water"
  | "transportation"
  | "other";

export type EmergencyPriority = "critical" | "high" | "medium" | "normal";

export type EmergencyStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "resolved"
  | "cancelled";

export interface EmergencyRequest {
  _id: string;
  userId: string | User;
  title: string;
  description: string;
  category: EmergencyCategory;
  priority: EmergencyPriority;
  location: GeoLocation;
  address?: string;
  images?: { url: string; publicId?: string }[];
  status: EmergencyStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface AssistanceAssignment {
  _id: string;
  requestId: string | EmergencyRequest;
  volunteerId: string | User;
  assignedBy?: string | User;
  status: "pending" | "accepted" | "in_progress" | "completed" | "rejected" | "cancelled";
  acceptedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface MissionVolunteer {
  _id?: string;
  name?: string;
  phone?: string | null;
  role?: string;
  profileImage?: string | null;
  verified?: boolean;
  skills?: string[];
  serviceRadius?: number;
  availability?: boolean;
  location?: GeoLocation | null;
}

export interface MissionInfo {
  _id: string;
  volunteer: MissionVolunteer;
  acceptedAt?: string;
  status?: string;
}

export interface MissionAcceptedPayload {
  emergency: EmergencyRequest;
  mission: MissionInfo;
  url?: string;
}

export interface PublicEmergencyTracking {
  id: string;
  title: string;
  description: string;
  category: EmergencyCategory;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  address?: string;
  coordinates: { latitude: number; longitude: number };
  googleMapsUrl: string;
  createdAt: string;
  resolvedAt?: string;
  requester: {
    name: string;
    phone?: string | null;
  };
  responder?: {
    name: string;
    phone?: string | null;
    status: string;
  } | null;
}
