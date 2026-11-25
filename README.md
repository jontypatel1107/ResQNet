# ResQNet – Disaster Response & Emergency Network

ResQNet is an enterprise-grade, offline-first disaster response and emergency relief coordination platform. It unifies **Citizens**, **First-Responder Volunteers**, and **System Administrators** into a single, cohesive React Native mobile application powered by an event-driven Node.js & Express MVC backend and MongoDB Atlas.

---

## 1. System Architecture

```text
                                +------------------------------------------+
                                |          ResQNet Mobile App              |
                                |       (Expo SDK 57 / React Native)       |
                                |                                          |
                                |   [Citizen]    [Volunteer]     [Admin]   |
                                +---------------------+--------------------+
                                                      |
                          +---------------------------+---------------------------+
                          | (HTTPS REST / Axios)                                  | (WebSockets / Socket.IO)
                          v                                                       v
        +-------------------------------------------------------------------------------+
        |                               Node.js + Express Backend                       |
        |                                                                               |
        |   Routes  -->  Auth & Role Middlewares  -->  Controllers  -->  Services/Events|
        +--------------------+------------------------------------+---------------------+
                             |                                    |
                             v                                    v
                  +---------------------+              +---------------------+
                  |   MongoDB Atlas     |              |     Cloudinary      |
                  | (GeoJSON & Mongoose)|              |  (Incident Images)  |
                  +---------------------+              +---------------------+
                             ^
                             | (Sync Queue on Reconnect)
                  +----------+----------+
                  |  Expo SQLite Engine |
                  |  (Offline Cache)    |
                  +---------------------+
```

### Role-Based Access Control (RBAC) in a Single App
ResQNet does **not** split functionality into separate applications:
- **Citizen**: Instant SOS dispatch, category selection (Medical, Rescue, Food, Water), GPS coordinates, and personal request timeline.
- **Volunteer**: Live radar of nearby emergencies within service radius, one-click mission acceptance, status progression (`accepted` → `in_progress` → `completed`), and duty toggle.
- **Admin**: City-wide oversight dashboard, resource allocation statistics, user verification, and disaster incident audits.

Role navigation is resolved automatically upon authentication, and independently enforced by backend middleware.

---

## 2. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Mobile Runtime** | React Native + Expo SDK 57 | React 19.2.3, React Native 0.86.3 |
| **Mobile Language** | TypeScript | Strict mode type safety |
| **Navigation** | Expo Router | File-based typed routes with stack and tab layouts |
| **State Management**| Zustand | Reactive client state and auth session management |
| **Network Client** | Axios | Configured with automatic JWT refresh interceptors |
| **Offline Storage** | Expo SQLite | Local SQLite database for cached requests & sync queue |
| **Real-Time** | Socket.IO Client | Bidirectional event channels (`role:volunteer`, `user:id`) |
| **Hardware APIs** | Expo Location, ImagePicker, Notifications, SecureStore | Device sensors, secure credential storage, and alerts |
| **Backend Runtime** | Node.js + Express.js | ES Modules architecture |
| **Cloud Database** | MongoDB Atlas | Mongoose ODM with 2dsphere geospatial indexing |
| **File Storage** | Cloudinary | Secure multi-part disaster scene image uploads |
| **Security** | Helmet, CORS, BCrypt, JWT, Rate-Limiting | Bank-grade security practices |
| **Validation** | Zod | Runtime schema validation for requests and payloads |

---

## 3. Project Directory Structure

```text
ResQNet/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # MongoDB Atlas connection
│   │   │   ├── cloudinary.js        # Media storage integration
│   │   │   └── socket.js            # Socket.IO room and event dispatcher
│   │   ├── models/
│   │   │   ├── User.js                  # Citizen, Volunteer, Admin profiles
│   │   │   ├── VolunteerProfile.js      # GeoJSON radius & skills
│   │   │   ├── EmergencyRequest.js      # GeoJSON incident coordinates & priority
│   │   │   ├── AssistanceAssignment.js  # 1-to-1 active assignment enforcement
│   │   │   ├── IncidentReport.js        # Community hazard alerts & verification
│   │   │   └── Notification.js          # Targeted and broadcast alerts
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── emergencyController.js
│   │   │   ├── volunteerController.js
│   │   │   ├── assignmentController.js
│   │   │   └── adminController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── emergencyRoutes.js
│   │   │   ├── volunteerRoutes.js
│   │   │   ├── assignmentRoutes.js
│   │   │   └── adminRoutes.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js        # JWT token verification
│   │   │   ├── roleMiddleware.js        # Multi-role access control
│   │   │   ├── validateMiddleware.js    # Zod payload parsing
│   │   │   └── errorMiddleware.js       # Centralized error handler
│   │   ├── services/
│   │   │   ├── emergencyService.js
│   │   │   ├── notificationService.js
│   │   │   └── assignmentService.js
│   │   ├── validators/
│   │   │   ├── authValidators.js
│   │   │   └── emergencyValidators.js
│   │   ├── utils/
│   │   │   └── response.js
│   │   ├── app.js                       # Express app configuration
│   │   └── server.js                    # HTTP + WebSocket server bootstrapper
│   ├── .env.example
│   ├── .env
│   ├── .gitignore
│   └── package.json
│
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx                  # Root stack layout & auth initialization
│   │   ├── index.tsx                    # Role-based splash router
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx                # Secure credential login
│   │   │   └── register.tsx             # Citizen / Volunteer onboarding
│   │   ├── (citizen)/
│   │   │   ├── _layout.tsx              # Bottom tabs layout
│   │   │   ├── dashboard.tsx            # High-visibility SOS trigger
│   │   │   ├── create-emergency.tsx     # GPS-tagged emergency request form
│   │   │   └── my-requests.tsx          # Real-time incident tracking
│   │   ├── (volunteer)/
│   │   │   ├── _layout.tsx              # Volunteer tabs
│   │   │   ├── dashboard.tsx            # Duty switch & mission telemetry
│   │   │   ├── nearby-requests.tsx      # Geospatial incident list
│   │   │   └── assignments.tsx          # Active rescue mission operations
│   │   ├── (admin)/
│   │   │   ├── _layout.tsx              # Admin tabs
│   │   │   ├── dashboard.tsx            # System metrics & analytics
│   │   │   ├── users.tsx                # User role management
│   │   │   └── incidents.tsx            # Field incident verification
│   │   └── emergency/
│   │       └── [id].tsx                 # Detailed incident screen
│   ├── src/
│   │   ├── constants/
│   │   │   └── colors.ts                # Emergency UI Design Tokens
│   │   ├── database/
│   │   │   ├── sqlite.ts                # SQLite schema & offline DB instance
│   │   │   └── sync.ts                  # Background retry sync engine
│   │   ├── services/
│   │   │   ├── api.ts                   # Axios client with JWT refresh interceptors
│   │   │   └── socket.ts                # Socket.io client singleton
│   │   ├── store/
│   │   │   └── authStore.ts             # Zustand persistent session store
│   │   └── types/
│   │       └── index.ts                 # Shared TypeScript models
│   ├── app.json
│   ├── .env.example
│   ├── .env
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 4. MongoDB Database & Schema Design

Database Name: `resqnet_db`

### Collection 1: `users`
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `name` | String | required, trim, min: 2, max: 60 | User full name |
| `email` | String | required, unique, lowercase | Unique email address |
| `phone` | String | required, trim | Contact telephone number |
| `passwordHash` | String | required, select: false | BCrypt password hash |
| `role` | String | enum: `["citizen", "volunteer", "admin"]` | Access level |
| `profileImage` | String | default: null | Cloudinary avatar URL |
| `isActive` | Boolean | default: true | Account activation status |

### Collection 2: `volunteerprofiles`
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `userId` | ObjectId | ref: `User`, required, unique | Parent user reference |
| `skills` | [String] | enum: `["first_aid", "medical", "rescue", "driving", "food_distribution", "general_assistance"]` | Verified competencies |
| `availability`| Boolean | default: false | Active duty readiness |
| `serviceRadius`| Number | default: 10, min: 1, max: 100 | Coverage distance in km |
| `location` | GeoJSON Point | coordinates: `[lng, lat]`, 2dsphere index | Base dispatch location |
| `verified` | Boolean | default: false | Admin verification status |

### Collection 3: `emergencyrequests`
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `userId` | ObjectId | ref: `User`, required, indexed | Incident requester |
| `title` | String | required, max: 100 | Emergency subject |
| `description` | String | required, max: 1000 | Incident situation report |
| `category` | String | enum: `["medical", "rescue", "food", "water", "transportation", "other"]` | Emergency domain |
| `priority` | String | enum: `["critical", "high", "medium", "normal"]` | Urgency classification |
| `location` | GeoJSON Point | coordinates: `[lng, lat]`, 2dsphere index | Exact GPS incident coordinates |
| `address` | String | default: "" | Human-readable address |
| `images` | [{ url, publicId }] | default: [] | Cloudinary photo evidence |
| `status` | String | enum: `["pending", "assigned", "accepted", "in_progress", "resolved", "cancelled"]` | Operational lifecycle |
| `resolvedAt` | Date | default: null | Resolution timestamp |

### Collection 4: `assistanceassignments`
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `requestId` | ObjectId | ref: `EmergencyRequest`, required, indexed | Targeted emergency |
| `volunteerId` | ObjectId | ref: `User`, required, indexed | Assigned responder |
| `assignedBy` | ObjectId | ref: `User`, default: null | Coordinator reference |
| `status` | String | enum: `["pending", "accepted", "in_progress", "completed", "rejected", "cancelled"]` | Mission progression |
| `acceptedAt` | Date | default: null | Timestamp of volunteer claim |
| `completedAt` | Date | default: null | Timestamp of mission resolution |

---

## 5. Design System & Visual Identity

The interface adheres to modern emergency UI standards prioritizing rapid recognition and high contrast:

- **Deep Navy** (`#14283F`): Authority, stability, and structure (Header, Navigation, Dark Surfaces).
- **Emergency Red** (`#E53935`): High-alert actions, SOS triggers, critical priorities.
- **Success Green** (`#168B70`): Resolved statuses, verified credentials, and active volunteers.
- **Warning Amber** (`#F57C00`): Medium alert levels, road blockages, pending actions.
- **Canvas Background** (`#F2F5F8`): Low-glare, readable surface for outdoor field visibility.

---

## 6. Setup & Execution Instructions

### Prerequisites
- Node.js (v18.x LTS or higher, v22 LTS tested)
- npm (v10+)
- MongoDB Atlas account with connection URI
- Cloudinary account for media assets
- Expo Go or Android Emulator / Physical Device for mobile

### Backend Setup
1. Open PowerShell and navigate to `backend`:
   ```powershell
   cd backend
   ```
2. Configure `.env` file (copy from `.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/resqnet_db
   JWT_ACCESS_SECRET=your_32_byte_random_secret_here
   JWT_REFRESH_SECRET=your_another_32_byte_random_secret_here
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLIENT_URL=*
   ```
   > **MongoDB Atlas tip:** If you see `Could not connect to any servers in your MongoDB Atlas cluster`,
   > add your current public IP in **Atlas -> Network Access -> Add IP Address** (or allow `0.0.0.0/0`
   > for local development only). The startup log now prints your detected public IP when a connection
   > fails. Also confirm the cluster is not paused and that the password in `MONGODB_URI` is URL-encoded.
3. Start the backend development server:
   ```powershell
   npm run dev
   ```
4. Verify server health:
   - `http://localhost:5000/`
   - `http://localhost:5000/api/health`

### Mobile Setup
1. Open a second PowerShell terminal and navigate to `mobile`:
   ```powershell
   cd mobile
   ```
2. Configure `mobile/.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:5000/api
   EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
   ```
   > **Note for Physical Devices**: Replace `localhost` with your machine's local LAN IP (e.g., `http://192.168.1.15:5000/api`).

3. Start the Expo development server:
   ```powershell
   npm start
   ```
4. Press `a` for Android Emulator, `w` for Web, or scan the QR code via Expo Go / Development Build on your device.

---

## 7. Phase Progression

- [x] **Phase 1: Architecture & Foundation**
  - MVC backend structure with JWT & RBAC security
  - MongoDB Atlas schemas with 2dsphere geospatial indexing
  - React Native Expo SDK 57 mobile app with unified 3-role routing
  - Offline-first SQLite database schema & sync queue
  - Emergency design system tokens
- [x] **Phase 2: Authentication & Profile Engine**
  - Robust JWT Access & Refresh token rotation and bcryptjs encryption
  - Dynamic Citizen & Volunteer onboarding with multi-skill picking, service radius, and GPS capture
  - SecureStore session persistence and automatic token refresh via Axios interceptors
  - Profile management & password change screens across all 3 roles (Citizen, Volunteer, Admin)
  - Admin volunteer verification & user deactivation endpoints
  - Automated initial administrator database seed script (`npm run seed:admin`)
- [ ] **Phase 3: Emergency Request & Dispatch** (SOS trigger, real-time map visualization, Socket.IO alerts)
- [ ] **Phase 4: Volunteer Operations & Assignment Workflow** (Claiming incidents, mission status, route directions)
- [ ] **Phase 5: Admin Oversight & Reporting** (Verification queues, city analytics, exportable disaster logs)
