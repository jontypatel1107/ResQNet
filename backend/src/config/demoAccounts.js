/**
 * Demo accounts used by the mobile login screen quick-presets.
 *
 * Keep these credentials in sync with:
 *   mobile/app/(auth)/login.tsx -> applyPreset()
 */
const defaultAdminEmail = "admin@resqnet.org";
const defaultAdminPassword = "Admin@ResQNet2026";

export const getDemoAccounts = () => [
  {
    key: "citizen",
    name: "Demo Citizen",
    email: "citizen@resqnet.org",
    phone: "+1 555-0101",
    password: "Citizen123!",
    role: "citizen",
  },
  {
    key: "volunteer",
    name: "Demo Volunteer",
    email: "volunteer@resqnet.org",
    phone: "+1 555-0102",
    password: "Volunteer123!",
    role: "volunteer",
    volunteerProfile: {
      skills: ["first_aid", "rescue", "general_assistance"],
      serviceRadius: 25,
      availability: true,
      verified: true,
      location: {
        type: "Point",
        coordinates: [-73.9857, 40.7484], // New York City
      },
    },
  },
  {
    key: "admin",
    name: "ResQNet Chief Administrator",
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || defaultAdminEmail,
    phone: "+1 555-0100",
    password: process.env.ADMIN_PASSWORD || defaultAdminPassword,
    role: "admin",
  },
];

export default getDemoAccounts;
