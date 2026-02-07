# Design Document: Tonight Meetup App

## Overview

Tonight is a mobile-first web application built with Next.js 14+ that enables spontaneous meetups between users. The architecture follows a monolithic Next.js pattern with API routes handling backend logic, PostgreSQL with PostGIS for geospatial data storage, and Socket.IO for real-time chat functionality.

The MVP focuses on 1-on-1 meetups with the following core flows:
1. **Authentication**: Magic link email authentication with JWT tokens
2. **Event Creation**: Hosts create events with location, time, and details
3. **Discovery**: Users find nearby events using geospatial queries
4. **Join Flow**: Users request to join, hosts accept/reject
5. **Chat**: Real-time messaging unlocks after join acceptance
6. **Safety**: Block and report functionality

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Next.js    │  │   Mapbox     │  │  Socket.IO   │      │
│  │  App Router  │  │   GL JS      │  │    Client    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / WSS
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Server                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Routes                               │   │
│  │  /api/auth/*  /api/events/*  /api/chat/*            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Socket.IO Server                            │   │
│  │  (Real-time chat message delivery)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Auth Middleware                               │   │
│  │  (JWT verification, user context)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Prisma ORM
                            │
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL + PostGIS                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Users, Events, JoinRequests, Messages,              │   │
│  │  BlockedUsers, Reports, MagicLinks                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 14+ with App Router
- React 18+
- Tailwind CSS for styling
- Mapbox GL JS for maps
- Socket.IO client for WebSockets
- Mobile-first responsive design

**Backend:**
- Next.js API routes
- Socket.IO server for real-time chat
- JWT authentication (jsonwebtoken library)
- Resend for email delivery
- Prisma ORM

**Database:**
- PostgreSQL 14+
- PostGIS extension for geospatial queries

### Authentication Flow

```
User                    Client                  Server                  Database
 │                        │                        │                        │
 │──Enter Email──────────>│                        │                        │
 │                        │──POST /api/auth/───────>│                        │
 │                        │   request-magic-link   │                        │
 │                        │                        │──Generate Token────────>│
 │                        │                        │  Store MagicLink       │
 │                        │                        │<───────────────────────│
 │                        │                        │──Send Email (Resend)──>│
 │                        │<───Success─────────────│                        │
 │<──Check Email──────────│                        │                        │
 │                        │                        │                        │
 │──Click Magic Link─────>│                        │                        │
 │                        │──GET /api/auth/verify──>│                        │
 │                        │   ?token=xxx           │──Verify Token──────────>│
 │                        │                        │  Mark as Used          │
 │                        │                        │<───────────────────────│
 │                        │                        │──Create/Get User───────>│
 │                        │                        │<───────────────────────│
 │                        │                        │──Generate JWT──────────│
 │                        │<───Set Cookie──────────│  (7-day expiration)    │
 │<──Logged In────────────│   (httpOnly)           │                        │
```

### Event Discovery Flow

```
User                    Client                  Server                  Database
 │                        │                        │                        │
 │──View Map/List────────>│                        │                        │
 │                        │──GET /api/events/──────>│                        │
 │                        │   nearby?lat=x&lng=y   │                        │
 │                        │                        │──PostGIS Query─────────>│
 │                        │                        │  ST_DWithin(location,  │
 │                        │                        │    ST_Point(x,y),      │
 │                        │                        │    10000)              │
 │                        │                        │  Filter: status=active │
 │                        │                        │  Exclude: blocked users│
 │                        │                        │<───────────────────────│
 │                        │<───Events with─────────│                        │
 │                        │    distances           │                        │
 │<──Display Events───────│                        │                        │
```

### Join and Chat Flow

```
Host        Joiner      Server                  Database              Socket.IO
 │            │           │                        │                      │
 │            │──Request──>│                        │                      │
 │            │   Join    │──Create JoinRequest────>│                      │
 │            │           │  (status: pending)     │                      │
 │            │           │<───────────────────────│                      │
 │<──Notification─────────│                        │                      │
 │            │           │                        │                      │
 │──Accept───────────────>│                        │                      │
 │            │           │──Update JoinRequest────>│                      │
 │            │           │  (status: accepted)    │                      │
 │            │           │<───────────────────────│                      │
 │            │<──Notification─────────────────────│                      │
 │            │           │                        │                      │
 │──Open Chat────────────>│                        │                      │
 │            │           │──Load Messages─────────>│                      │
 │            │           │<───────────────────────│                      │
 │<──Messages─────────────│                        │                      │
 │            │           │                        │                      │
 │──Send Msg─────────────>│──Store Message─────────>│                      │
 │            │           │<───────────────────────│                      │
 │            │           │──Emit via Socket.IO────────────────────────────>│
 │            │<──Receive Message──────────────────────────────────────────│
```

## Components and Interfaces

### Frontend Components

#### Authentication Components

**LoginPage** (`/app/login/page.tsx`)
- Email input form
- Magic link request handling
- Success/error message display

**AuthProvider** (`/components/AuthProvider.tsx`)
- React Context for authentication state
- Fetches current user on mount
- Provides user data and logout function to children

#### Event Components

**CreateEventPage** (`/app/events/create/page.tsx`)
- Event form (title, description, datetime)
- Mapbox location picker
- Form validation and submission

**EventMapView** (`/components/EventMapView.tsx`)
- Mapbox GL JS map instance
- Event markers with popups
- User location marker
- Click handlers for event details

**EventListView** (`/components/EventListView.tsx`)
- List of event cards
- Distance display
- Click handlers for event details

**EventDetailModal** (`/components/EventDetailModal.tsx`)
- Event information display
- Join request button
- Host information

#### Chat Components

**ChatPage** (`/app/chat/[joinRequestId]/page.tsx`)
- Message history display
- Message input form
- Socket.IO connection management
- Real-time message updates

**MessageList** (`/components/MessageList.tsx`)
- Scrollable message container
- Message bubbles (sent/received styling)
- Timestamp display

#### Profile Components

**ProfilePage** (`/app/profile/page.tsx`)
- Display name editor
- Photo upload
- User information display

**UserAvatar** (`/components/UserAvatar.tsx`)
- Profile photo display
- Fallback to initials
- Size variants

#### Safety Components

**BlockUserButton** (`/components/BlockUserButton.tsx`)
- Block confirmation dialog
- Block action handler

**ReportModal** (`/components/ReportModal.tsx`)
- Report form (reason, description)
- Submit handler for user/event reports

### Backend API Routes

#### Authentication Endpoints

**POST /api/auth/request-magic-link**
```typescript
Request: { email: string }
Response: { success: boolean, message: string }
```
- Validates email format
- Generates unique token (32 bytes, hex)
- Creates MagicLink record (15-minute expiration)
- Sends email via Resend (or logs in dev mode)

**GET /api/auth/verify**
```typescript
Query: { token: string }
Response: Redirect to / with cookie set
```
- Validates token exists and not expired
- Marks token as used
- Creates or retrieves User record
- Generates JWT (7-day expiration)
- Sets httpOnly cookie
- Redirects to home page

**GET /api/auth/me**
```typescript
Response: { user: User | null }
```
- Verifies JWT from cookie
- Returns current user data or null

**POST /api/auth/logout**
```typescript
Response: { success: boolean }
```
- Clears authentication cookie

#### Event Endpoints

**POST /api/events**
```typescript
Request: {
  title: string
  description: string
  datetime: string (ISO 8601)
  location: { lat: number, lng: number }
  locationName: string
  maxParticipants?: number
}
Response: { event: Event }
```
- Requires authentication
- Validates datetime is in future
- Creates event with PostGIS POINT
- Sets status to "active"

**GET /api/events/nearby**
```typescript
Query: {
  lat: number
  lng: number
  radius?: number (default 10000 meters)
}
Response: { events: EventWithDistance[] }
```
- Requires authentication
- Uses PostGIS ST_DWithin for geospatial query
- Calculates distance using ST_Distance
- Filters out expired events
- Excludes events from blocked users
- Orders by distance

**GET /api/events/[id]**
```typescript
Response: { event: Event }
```
- Returns event details
- Includes host information

#### Join Request Endpoints

**POST /api/join-requests**
```typescript
Request: { eventId: string }
Response: { joinRequest: JoinRequest }
```
- Requires authentication
- Validates event exists and is active
- Checks max participants not exceeded
- Prevents duplicate join requests
- Creates join request with status "pending"

**PATCH /api/join-requests/[id]**
```typescript
Request: { status: "accepted" | "rejected" }
Response: { joinRequest: JoinRequest }
```
- Requires authentication
- Validates user is event host
- Updates join request status

**GET /api/join-requests/for-event/[eventId]**
```typescript
Response: { joinRequests: JoinRequest[] }
```
- Requires authentication
- Validates user is event host
- Returns all join requests for event

#### Chat Endpoints

**GET /api/chat/[joinRequestId]/messages**
```typescript
Response: { messages: Message[] }
```
- Requires authentication
- Validates user is host or joiner
- Validates join request is accepted
- Returns message history ordered by timestamp

**POST /api/chat/[joinRequestId]/messages**
```typescript
Request: { content: string }
Response: { message: Message }
```
- Requires authentication
- Validates user is host or joiner
- Validates join request is accepted
- Creates message record
- Emits message via Socket.IO

#### User Endpoints

**PATCH /api/users/me**
```typescript
Request: {
  displayName?: string
  photoUrl?: string
}
Response: { user: User }
```
- Requires authentication
- Updates current user profile

**POST /api/users/block**
```typescript
Request: { userId: string }
Response: { success: boolean }
```
- Requires authentication
- Creates BlockedUser record
- Prevents duplicate blocks

#### Report Endpoints

**POST /api/reports**
```typescript
Request: {
  eventId?: string
  reportedUserId?: string
  reason: string
  description?: string
}
Response: { report: Report }
```
- Requires authentication
- Validates either eventId or reportedUserId provided
- Creates report with status "pending"

### Backend Services

#### Auth Service (`lib/auth.ts`)

```typescript
interface AuthService {
  generateMagicLinkToken(): string
  generateJWT(userId: string): string
  verifyJWT(token: string): { userId: string } | null
  hashToken(token: string): string
}
```

**generateMagicLinkToken()**
- Generates 32-byte random hex string
- Returns unhashed token for email

**generateJWT(userId: string)**
- Creates JWT with userId payload
- Sets 7-day expiration
- Signs with secret from environment

**verifyJWT(token: string)**
- Verifies JWT signature
- Checks expiration
- Returns userId or null

**hashToken(token: string)**
- Hashes token for database storage
- Uses SHA-256

#### Email Service (`lib/email.ts`)

```typescript
interface EmailService {
  sendMagicLink(email: string, token: string): Promise<void>
}
```

**sendMagicLink(email: string, token: string)**
- In production: sends email via Resend API
- In development: logs magic link URL to console
- Constructs verification URL with token
- Uses email template with clear instructions

#### Geospatial Service (`lib/geospatial.ts`)

```typescript
interface GeospatialService {
  findNearbyEvents(
    lat: number,
    lng: number,
    radiusMeters: number,
    userId: string
  ): Promise<EventWithDistance[]>
  
  calculateDistance(
    point1: { lat: number, lng: number },
    point2: { lat: number, lng: number }
  ): number
}
```

**findNearbyEvents()**
- Constructs PostGIS query with ST_DWithin
- Filters by status = "active"
- Excludes events where user is blocked
- Calculates distance with ST_Distance
- Orders by distance ascending
- Returns events with distance in meters

**calculateDistance()**
- Uses PostGIS ST_Distance for accurate geodesic distance
- Returns distance in meters

#### Socket.IO Service (`lib/socket.ts`)

```typescript
interface SocketService {
  initialize(server: Server): void
  emitMessage(joinRequestId: string, message: Message): void
}
```

**initialize(server: Server)**
- Creates Socket.IO server instance
- Configures CORS for Next.js
- Sets up connection handler
- Authenticates socket connections via JWT
- Joins users to room based on joinRequestId

**emitMessage(joinRequestId: string, message: Message)**
- Emits message to specific room (joinRequestId)
- Only host and joiner receive the message

### Middleware

#### Auth Middleware (`middleware/auth.ts`)

```typescript
interface AuthMiddleware {
  requireAuth(handler: ApiHandler): ApiHandler
  getCurrentUser(req: NextRequest): User | null
}
```

**requireAuth(handler)**
- Wraps API route handler
- Extracts JWT from cookie
- Verifies JWT
- Fetches user from database
- Attaches user to request context
- Returns 401 if authentication fails

**getCurrentUser(req)**
- Extracts JWT from cookie
- Verifies JWT
- Returns user or null

## Data Models

### User Model

```typescript
interface User {
  id: string              // CUID
  email: string           // Unique
  displayName: string | null
  photoUrl: string | null
  createdAt: Date
  updatedAt: Date
}
```

**Relationships:**
- One-to-many with Event (as host)
- One-to-many with JoinRequest
- One-to-many with Message (as sender)
- One-to-many with BlockedUser (as blocker)
- One-to-many with BlockedUser (as blocked)
- One-to-many with Report (as reporter)

### Event Model

```typescript
interface Event {
  id: string              // CUID
  hostId: string          // Foreign key to User
  title: string
  description: string | null
  datetime: Date
  location: Point         // PostGIS geography(Point, 4326)
  locationName: string
  maxParticipants: number // Default 2
  status: EventStatus     // "active" | "cancelled" | "completed" | "expired"
  createdAt: Date
  updatedAt: Date
}

type EventStatus = "active" | "cancelled" | "completed" | "expired"

interface Point {
  lat: number
  lng: number
}

interface EventWithDistance extends Event {
  distance: number        // Distance in meters
}
```

**Relationships:**
- Many-to-one with User (host)
- One-to-many with JoinRequest
- One-to-many with Report

**Indexes:**
- GIST index on location for geospatial queries
- Index on datetime for expiration queries
- Index on status for filtering

### JoinRequest Model

```typescript
interface JoinRequest {
  id: string              // CUID
  eventId: string         // Foreign key to Event
  userId: string          // Foreign key to User
  status: JoinRequestStatus // "pending" | "accepted" | "rejected"
  createdAt: Date
  updatedAt: Date
}

type JoinRequestStatus = "pending" | "accepted" | "rejected"
```

**Relationships:**
- Many-to-one with Event
- Many-to-one with User
- One-to-many with Message

**Constraints:**
- Unique constraint on (eventId, userId) to prevent duplicate requests

### Message Model

```typescript
interface Message {
  id: string              // CUID
  joinRequestId: string   // Foreign key to JoinRequest
  senderId: string        // Foreign key to User
  content: string
  createdAt: Date
}
```

**Relationships:**
- Many-to-one with JoinRequest
- Many-to-one with User (sender)

**Indexes:**
- Index on joinRequestId for efficient message history queries
- Index on createdAt for ordering

### BlockedUser Model

```typescript
interface BlockedUser {
  id: string              // CUID
  blockerId: string       // Foreign key to User
  blockedId: string       // Foreign key to User
  createdAt: Date
}
```

**Relationships:**
- Many-to-one with User (blocker)
- Many-to-one with User (blocked)

**Constraints:**
- Unique constraint on (blockerId, blockedId)

### Report Model

```typescript
interface Report {
  id: string              // CUID
  reporterId: string      // Foreign key to User
  eventId: string | null  // Foreign key to Event (optional)
  reportedUserId: string | null // Foreign key to User (optional)
  reason: string
  description: string | null
  status: ReportStatus    // "pending" | "reviewed" | "resolved"
  createdAt: Date
}

type ReportStatus = "pending" | "reviewed" | "resolved"
```

**Relationships:**
- Many-to-one with User (reporter)
- Many-to-one with Event (optional)

**Constraints:**
- Check constraint: eventId OR reportedUserId must be non-null

### MagicLink Model

```typescript
interface MagicLink {
  id: string              // CUID
  email: string
  token: string           // Unique, hashed
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}
```

**Indexes:**
- Unique index on token
- Index on expiresAt for cleanup queries


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **Authentication properties**: Multiple criteria about JWT validation (11.4, 11.5, 15.6) can be combined into comprehensive authentication properties
2. **Access control properties**: Protected endpoint requirements (15.1-15.5) can be combined into a single property about authentication requirements
3. **Timestamp properties**: Creation and update timestamps (14.5, 14.6) can be combined into a single property about automatic timestamp management
4. **Blocking properties**: Multiple blocking criteria (9.3, 9.4, 9.5) can be combined into comprehensive blocking behavior properties
5. **Status properties**: Event status and join request status transitions can be consolidated
6. **Round-trip properties**: Several criteria are best tested as round-trips (profile updates, message storage, report creation)

### Authentication Properties

**Property 1: Magic Link Token Generation and Expiration**
*For any* email address, when a magic link is requested, the system should generate a unique token with an expiration time exactly 15 minutes from creation.
**Validates: Requirements 1.1, 1.2**

**Property 2: Magic Link Authentication Round Trip**
*For any* valid, unexpired magic link token, verifying the token should create or retrieve a user account and issue a JWT with 7-day expiration stored in an httpOnly cookie.
**Validates: Requirements 1.3, 1.4**

**Property 3: Expired Token Rejection**
*For any* magic link token where the current time is after the expiration time, authentication attempts should be rejected with an error.
**Validates: Requirements 1.5**

**Property 4: Single-Use Token Enforcement**
*For any* magic link token, after it has been used once (usedAt is set), subsequent authentication attempts with that token should be rejected.
**Validates: Requirements 1.6**

**Property 5: Logout Cookie Clearing**
*For any* authenticated user session, logging out should clear the authentication cookie.
**Validates: Requirements 1.7**

**Property 6: JWT Authentication Round Trip**
*For any* valid JWT token in a cookie, requests to protected endpoints should authenticate the user and provide access to their user data.
**Validates: Requirements 11.1, 11.2**

**Property 7: JWT Expiration Enforcement**
*For any* JWT token where the current time is after the expiration time, requests to protected endpoints should be rejected with an authentication error.
**Validates: Requirements 11.3, 11.5**

**Property 8: Protected Endpoint Authentication**
*For any* protected endpoint (events, join requests, chat, profile, block, report), unauthenticated requests should be rejected with an authentication error.
**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6**

### User Profile Properties

**Property 9: First Authentication User Creation**
*For any* email address that has never authenticated before, completing magic link authentication should create a new user profile with that email and a unique identifier.
**Validates: Requirements 2.1**

**Property 10: Profile Update Round Trip**
*For any* authenticated user and valid profile data (displayName, photoUrl), updating the profile should store the data such that retrieving the profile returns the updated values.
**Validates: Requirements 2.2, 2.3, 2.4, 2.6**

**Property 11: Profile Creation Timestamp**
*For any* user profile, the creation date should be set automatically and be accessible when viewing the profile.
**Validates: Requirements 2.5**

### Event Creation Properties

**Property 12: Event Creation with All Fields**
*For any* authenticated user and valid event data (title, description, future datetime, location coordinates, location name, max participants), creating an event should store all fields with the user as host and status "active".
**Validates: Requirements 3.1, 3.2, 3.4, 3.6**

**Property 13: Location Storage as PostGIS Point**
*For any* event location coordinates (latitude, longitude), the system should store them as a PostGIS POINT with SRID 4326.
**Validates: Requirements 3.3, 14.3**

**Property 14: Max Participants Default Value**
*For any* event created without specifying max participants, the system should default to 2 participants.
**Validates: Requirements 3.5**

**Property 15: Future Datetime Validation**
*For any* event creation attempt with a datetime in the past, the system should reject the creation with a validation error.
**Validates: Requirements 3.7**

### Event Expiration Properties

**Property 16: Automatic Event Expiration**
*For any* event where the current time is after the event's datetime, the event status should be marked as "expired".
**Validates: Requirements 4.1**

**Property 17: Expired Event Exclusion from Discovery**
*For any* discovery query, events with status "expired" should not be included in the results.
**Validates: Requirements 4.2**

### Geospatial Discovery Properties

**Property 18: Radius-Based Event Discovery**
*For any* user location and radius, the discovery query should return only events within that radius (using ST_DWithin), excluding expired events, events from blocked users, and events where the user is blocked by the host.
**Validates: Requirements 5.1, 5.4, 5.5, 5.6**

**Property 19: Default Radius Application**
*For any* discovery query without a specified radius, the system should default to 10,000 meters (10 kilometers).
**Validates: Requirements 5.2**

**Property 20: Distance Calculation and Inclusion**
*For any* event returned in discovery results, the response should include the calculated distance in meters from the user's location to the event location.
**Validates: Requirements 5.3**

**Property 21: Distance-Based Result Ordering**
*For any* set of discovery results, events should be ordered by increasing distance from the user's location.
**Validates: Requirements 5.7**

### Event Display Properties

**Property 22: List View Required Fields**
*For any* event displayed in list view, the rendered output should contain the title, datetime, location name, and distance.
**Validates: Requirements 6.4**

### Join Request Properties

**Property 23: Join Request Creation with Pending Status**
*For any* user requesting to join an event, the system should create a join request with status "pending".
**Validates: Requirements 7.1**

**Property 24: Duplicate Join Request Prevention**
*For any* user and event pair, attempting to create multiple join requests should result in only one join request existing (subsequent attempts should be rejected).
**Validates: Requirements 7.2**

**Property 25: Join Request Status Transitions**
*For any* pending join request, the host should be able to update the status to "accepted" or "rejected", and the updated status should be reflected in the database.
**Validates: Requirements 7.4, 7.5, 7.6**

**Property 26: Max Participants Enforcement**
*For any* event with max_participants set to 2, once one join request is accepted, additional join requests should be rejected.
**Validates: Requirements 7.7**

### Chat Properties

**Property 27: Chat Access Control for Accepted Requests**
*For any* join request with status "accepted", both the host and joiner should be able to access the chat and send messages.
**Validates: Requirements 8.1**

**Property 28: Chat Access Denial for Non-Accepted Requests**
*For any* join request with status "pending" or "rejected", attempts to access the chat or send messages should be rejected.
**Validates: Requirements 8.2**

**Property 29: Message Storage Round Trip**
*For any* message sent in an accepted join request chat, the message should be stored in the database with sender, content, timestamp, and join request association, such that loading the message history returns the message.
**Validates: Requirements 8.4, 8.5, 8.7**

**Property 30: Real-Time Message Delivery**
*For any* message sent via WebSocket in an accepted join request chat, the message should be delivered in real-time to the other party (host or joiner).
**Validates: Requirements 8.3**

### Blocking Properties

**Property 31: Block Record Creation**
*For any* two users where user A blocks user B, the system should create a blocked user record with A as blocker and B as blocked.
**Validates: Requirements 9.1, 9.2**

**Property 32: Bidirectional Event Discovery Blocking**
*For any* two users where user A blocks user B, neither A should see B's events in discovery, nor should B see A's events in discovery.
**Validates: Requirements 9.3, 9.4**

**Property 33: Message Blocking**
*For any* two users where user A blocks user B, neither A nor B should be able to send messages to each other in any chat.
**Validates: Requirements 9.5**

**Property 34: Duplicate Block Prevention**
*For any* user pair, attempting to create multiple block records should result in only one block record existing.
**Validates: Requirements 9.6**

### Reporting Properties

**Property 35: Report Creation Round Trip**
*For any* user reporting an event or another user with a reason and optional description, the system should create a report with status "pending" and all provided fields, such that the report can be retrieved with all data intact.
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

### Data Persistence Properties

**Property 36: Referential Integrity Enforcement**
*For any* entity with foreign key relationships (events to users, join requests to events/users, messages to join requests/users), the system should maintain referential integrity by preventing orphaned records.
**Validates: Requirements 14.4**

**Property 37: Automatic Timestamp Management**
*For any* entity creation, the system should automatically set a creation timestamp, and for any entity update, the system should automatically update the modification timestamp.
**Validates: Requirements 14.5, 14.6**

### Location Selection Properties

**Property 38: Map Click Coordinate Capture**
*For any* map click during event creation, the system should capture the geographic coordinates of the clicked point and allow updating the selection by clicking a different point.
**Validates: Requirements 12.2, 12.4**

### Email Delivery Properties

**Property 39: Magic Link Email Content**
*For any* magic link email sent, the email should contain the magic link URL and clear login instructions.
**Validates: Requirements 13.2, 13.3**

**Property 40: Email Delivery Error Handling**
*For any* magic link email that fails to send, the system should return an error to the user.
**Validates: Requirements 13.4**

## Error Handling

### Authentication Errors

**Invalid or Expired Tokens**
- HTTP 401 Unauthorized
- Clear error message indicating token is invalid or expired
- Client should redirect to login page

**Missing Authentication**
- HTTP 401 Unauthorized
- Error message: "Authentication required"
- Client should redirect to login page

**Used Magic Link**
- HTTP 400 Bad Request
- Error message: "This magic link has already been used"
- Prompt user to request a new magic link

### Validation Errors

**Invalid Event Data**
- HTTP 400 Bad Request
- Specific field validation errors (e.g., "Event datetime must be in the future")
- Client should display validation errors inline

**Invalid Profile Data**
- HTTP 400 Bad Request
- Specific field validation errors
- Client should display validation errors inline

**Duplicate Join Request**
- HTTP 409 Conflict
- Error message: "You have already requested to join this event"
- Client should display error message

**Max Participants Exceeded**
- HTTP 409 Conflict
- Error message: "This event is already full"
- Client should display error message and disable join button

### Authorization Errors

**Unauthorized Action**
- HTTP 403 Forbidden
- Error message: "You are not authorized to perform this action"
- Examples: Non-host trying to accept join requests, accessing chat for non-accepted join request

**Blocked User Access**
- HTTP 403 Forbidden
- Error message: "You cannot access this resource"
- Used when blocked users try to interact with each other

### Resource Errors

**Not Found**
- HTTP 404 Not Found
- Error message: "Resource not found"
- Used for non-existent events, users, join requests, etc.

**Database Errors**
- HTTP 500 Internal Server Error
- Generic error message: "An error occurred. Please try again."
- Log detailed error server-side for debugging
- Never expose database details to client

### Email Delivery Errors

**Resend API Failure**
- HTTP 500 Internal Server Error
- Error message: "Failed to send email. Please try again."
- Log detailed error server-side
- Retry logic with exponential backoff

### WebSocket Errors

**Connection Failure**
- Client-side error handling
- Automatic reconnection with exponential backoff
- Display "Connecting..." status to user

**Message Delivery Failure**
- Store message locally
- Retry sending when connection restored
- Display "Sending..." status to user

**Authentication Failure**
- Close WebSocket connection
- Redirect to login page
- Display "Session expired" message

## Testing Strategy

### Dual Testing Approach

The Tonight app will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific authentication flows (valid login, expired token, used token)
- Specific geospatial queries with known coordinates
- Edge cases (empty strings, boundary values, null handling)
- Error conditions (network failures, database errors)
- Integration between components (API routes, database, WebSocket)

**Property-Based Tests**: Verify universal properties across all inputs
- Generate random user data, event data, locations, timestamps
- Test properties hold for all generated inputs
- Catch edge cases that manual testing might miss
- Provide confidence in correctness across the input space

### Property-Based Testing Configuration

**Library**: We will use **fast-check** for JavaScript/TypeScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `// Feature: tonight-meetup-app, Property {N}: {property text}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

// Feature: tonight-meetup-app, Property 1: Magic Link Token Generation and Expiration
test('magic link tokens have 15-minute expiration', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.emailAddress(),
      async (email) => {
        const result = await requestMagicLink(email);
        const magicLink = await getMagicLinkFromDb(email);
        
        const expectedExpiration = new Date(magicLink.createdAt.getTime() + 15 * 60 * 1000);
        expect(magicLink.expiresAt).toEqual(expectedExpiration);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Organization

**Unit Tests** (`__tests__/unit/`)
- `auth.test.ts`: Authentication service tests
- `geospatial.test.ts`: Geospatial query tests
- `email.test.ts`: Email service tests
- `socket.test.ts`: Socket.IO service tests

**Property Tests** (`__tests__/properties/`)
- `auth.properties.test.ts`: Properties 1-8
- `profile.properties.test.ts`: Properties 9-11
- `events.properties.test.ts`: Properties 12-17
- `discovery.properties.test.ts`: Properties 18-22
- `join-requests.properties.test.ts`: Properties 23-26
- `chat.properties.test.ts`: Properties 27-30
- `blocking.properties.test.ts`: Properties 31-34
- `reporting.properties.test.ts`: Property 35
- `persistence.properties.test.ts`: Properties 36-37
- `location.properties.test.ts`: Property 38
- `email.properties.test.ts`: Properties 39-40

**Integration Tests** (`__tests__/integration/`)
- `api-routes.test.ts`: End-to-end API route tests
- `websocket.test.ts`: WebSocket connection and message delivery tests
- `database.test.ts`: Database operations and migrations

**UI Tests** (`__tests__/ui/`)
- `pages.test.ts`: Verify pages render
- `components.test.ts`: Verify key components render
- `forms.test.ts`: Verify forms are functional

### Test Data Generation

**Generators for Property Tests**:
```typescript
// User generators
const userEmailGen = fc.emailAddress();
const displayNameGen = fc.string({ minLength: 1, maxLength: 50 });
const userIdGen = fc.uuid();

// Event generators
const eventTitleGen = fc.string({ minLength: 1, maxLength: 100 });
const eventDescriptionGen = fc.string({ maxLength: 1000 });
const futureDatetimeGen = fc.date({ min: new Date() });
const pastDatetimeGen = fc.date({ max: new Date() });
const locationGen = fc.record({
  lat: fc.double({ min: -90, max: 90 }),
  lng: fc.double({ min: -180, max: 180 })
});
const maxParticipantsGen = fc.integer({ min: 2, max: 10 });

// Token generators
const tokenGen = fc.hexaString({ minLength: 64, maxLength: 64 });
const jwtGen = fc.string(); // Will use actual JWT generation in tests

// Message generators
const messageContentGen = fc.string({ minLength: 1, maxLength: 1000 });

// Status generators
const eventStatusGen = fc.constantFrom('active', 'cancelled', 'completed', 'expired');
const joinRequestStatusGen = fc.constantFrom('pending', 'accepted', 'rejected');
const reportStatusGen = fc.constantFrom('pending', 'reviewed', 'resolved');
```

### Testing Environment

**Database**:
- Use separate test database
- Reset database between test suites
- Use transactions for test isolation where possible

**Email**:
- Always use development mode (console logging) in tests
- Mock Resend API for integration tests

**WebSocket**:
- Use Socket.IO test utilities
- Mock WebSocket connections for unit tests
- Use real connections for integration tests

**External Services**:
- Mock Mapbox API calls
- Use test API keys where necessary

### Continuous Integration

**Pre-commit**:
- Run linter (ESLint)
- Run type checker (TypeScript)
- Run fast unit tests

**CI Pipeline**:
- Run all unit tests
- Run all property tests (100 iterations each)
- Run integration tests
- Run UI tests
- Generate coverage report (target: 80%+ coverage)
- Build application
- Run database migrations on test database

### Manual Testing Checklist

While automated tests provide comprehensive coverage, manual testing should verify:
- Mobile responsiveness on actual devices
- Map interactions feel smooth
- Real-time chat latency is acceptable
- Email delivery works in production
- User experience flows are intuitive
- Accessibility with screen readers
- Performance with realistic data volumes
