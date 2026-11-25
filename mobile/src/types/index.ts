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
  cancelledAt?: string;
  notes?: string;
}
