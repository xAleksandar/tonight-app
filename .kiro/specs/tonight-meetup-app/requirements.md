# Requirements Document: Tonight Meetup App

## Introduction

Tonight is a mobile-first web application that connects people who have free time and want to participate in spontaneous activities together. Users can create events for activities they plan to do, browse nearby events created by others, and join events to meet new people. The MVP focuses on 1-on-1 meetups with real-time chat, geospatial discovery, and essential safety features.

## Glossary

- **System**: The Tonight web application
- **User**: A person who has authenticated and can use the application
- **Host**: A user who creates an event
- **Joiner**: A user who requests to join an event
- **Event**: A planned activity with a specific time, location, and description
- **Join_Request**: A request from a user to participate in an event
- **Magic_Link**: A time-limited authentication token sent via email
- **Chat**: Real-time messaging between host and accepted joiner
- **Blocked_User**: A user who has been blocked by another user
- **Report**: A safety report about a user or event
- **Geospatial_Query**: A database query using location coordinates and distance
- **JWT**: JSON Web Token used for authentication
- **PostGIS**: PostgreSQL extension for geographic objects and queries

## Requirements

### Requirement 1: Magic Link Authentication

**User Story:** As a user, I want to log in using my email address without creating a password, so that I can quickly access the app securely.

#### Acceptance Criteria

1. WHEN a user submits their email address, THE System SHALL generate a unique magic link token and send it to that email address
2. WHEN a magic link token is generated, THE System SHALL set an expiration time of 15 minutes from creation
3. WHEN a user clicks a valid magic link, THE System SHALL create or retrieve the user account and issue a JWT token with 7-day expiration
4. WHEN a JWT token is issued, THE System SHALL store it in an httpOnly cookie
5. IF a magic link token has expired, THEN THE System SHALL reject the authentication attempt and return an error message
6. IF a magic link token has already been used, THEN THE System SHALL reject subsequent authentication attempts with that token
7. WHEN a user logs out, THE System SHALL clear the authentication cookie
8. WHERE the application is in development mode, THE System SHALL log magic link URLs to the console instead of sending emails

### Requirement 2: User Profile Management

**User Story:** As a user, I want to create and manage my profile, so that other users can learn about me before meeting.

#### Acceptance Criteria

1. WHEN a user first authenticates, THE System SHALL create a user profile with their email address and a unique identifier
2. THE System SHALL allow users to set a display name for their profile
3. THE System SHALL allow users to upload a profile photo
4. WHEN a user uploads a profile photo, THE System SHALL store the photo URL in the user profile
5. THE System SHALL display the user's creation date on their profile
6. THE System SHALL allow users to view their own profile information

### Requirement 3: Event Creation

**User Story:** As a host, I want to create events for activities I plan to do, so that others can discover and join me.

#### Acceptance Criteria

1. THE System SHALL allow authenticated users to create events with a title, description, datetime, location, and max participants
2. WHEN a user creates an event, THE System SHALL store the event with the user as the host
3. WHEN a user selects a location, THE System SHALL capture the geographic coordinates as a PostGIS POINT with SRID 4326
4. WHEN a user creates an event, THE System SHALL store a human-readable location name alongside the coordinates
5. WHERE max participants is not specified, THE System SHALL default to 2 participants (host + 1 joiner)
6. WHEN an event is created, THE System SHALL set the event status to "active"
7. THE System SHALL require that event datetime is in the future at creation time

### Requirement 4: Event Expiration

**User Story:** As a user, I want old events to automatically disappear, so that I only see relevant upcoming activities.

#### Acceptance Criteria

1. WHEN the current time passes an event's datetime, THE System SHALL mark the event status as "expired"
2. WHEN querying for events, THE System SHALL exclude events with status "expired" from discovery results
3. THE System SHALL check for expired events before returning discovery results

### Requirement 5: Geospatial Event Discovery

**User Story:** As a user, I want to discover events happening near my current location, so that I can find activities within a reasonable distance.

#### Acceptance Criteria

1. WHEN a user requests nearby events, THE System SHALL use PostGIS ST_DWithin to query events within a specified radius
2. WHERE radius is not specified, THE System SHALL default to 10 kilometers
3. WHEN returning nearby events, THE System SHALL calculate and include the distance from the user's location to each event
4. THE System SHALL exclude events created by blocked users from discovery results
5. THE System SHALL exclude events where the user has been blocked by the host from discovery results
6. THE System SHALL only return events with status "active"
7. THE System SHALL order results by distance from the user's location

### Requirement 6: Event Display Modes

**User Story:** As a user, I want to view nearby events on a map or in a list, so that I can choose my preferred way to browse activities.

#### Acceptance Criteria

1. THE System SHALL provide a map view displaying event locations as markers
2. WHEN displaying events on a map, THE System SHALL use Mapbox GL JS for rendering
3. THE System SHALL provide a list view displaying events with their distance from the user
4. WHEN displaying events in list view, THE System SHALL show title, datetime, location name, and distance for each event
5. THE System SHALL allow users to switch between map view and list view

### Requirement 7: Join Request Flow

**User Story:** As a joiner, I want to request to join events, so that I can participate in activities that interest me.

#### Acceptance Criteria

1. WHEN a user requests to join an event, THE System SHALL create a join request with status "pending"
2. THE System SHALL prevent users from creating multiple join requests for the same event
3. WHEN a join request is created, THE System SHALL notify the event host
4. THE System SHALL allow the host to accept or reject pending join requests
5. WHEN a host accepts a join request, THE System SHALL update the join request status to "accepted"
6. WHEN a host rejects a join request, THE System SHALL update the join request status to "rejected"
7. WHERE an event has max_participants set to 2, THE System SHALL prevent additional join requests once one request is accepted

### Requirement 8: Real-Time Chat

**User Story:** As a host or accepted joiner, I want to chat in real-time with my meetup partner, so that we can coordinate details before meeting.

#### Acceptance Criteria

1. WHEN a join request is accepted, THE System SHALL enable chat functionality between the host and joiner
2. THE System SHALL prevent chat access for join requests with status "pending" or "rejected"
3. WHEN a user sends a message, THE System SHALL deliver it in real-time using WebSocket connections
4. WHEN a user sends a message, THE System SHALL store the message in the database with sender, content, and timestamp
5. WHEN a user opens a chat, THE System SHALL load and display the complete message history
6. THE System SHALL use Socket.IO for WebSocket communication
7. THE System SHALL associate all messages with the specific join request they belong to

### Requirement 9: User Blocking

**User Story:** As a user, I want to block other users, so that I can avoid interactions with people I don't want to meet.

#### Acceptance Criteria

1. THE System SHALL allow users to block other users
2. WHEN a user blocks another user, THE System SHALL create a blocked user record with blocker and blocked user identifiers
3. WHEN a user blocks another user, THE System SHALL prevent the blocked user from seeing the blocker's events in discovery
4. WHEN a user blocks another user, THE System SHALL prevent the blocker from seeing the blocked user's events in discovery
5. WHEN a user blocks another user, THE System SHALL prevent both users from sending messages to each other
6. THE System SHALL prevent duplicate block records for the same user pair

### Requirement 10: Reporting System

**User Story:** As a user, I want to report inappropriate users or events, so that the community remains safe and respectful.

#### Acceptance Criteria

1. THE System SHALL allow users to report events with a reason and optional description
2. THE System SHALL allow users to report other users with a reason and optional description
3. WHEN a report is created, THE System SHALL set the report status to "pending"
4. WHEN a report is created, THE System SHALL store the reporter's identifier, reported entity, reason, description, and timestamp
5. THE System SHALL associate event reports with the specific event being reported
6. THE System SHALL associate user reports with the specific user being reported

### Requirement 11: Authentication State Management

**User Story:** As a user, I want my login session to persist across page refreshes, so that I don't have to log in repeatedly.

#### Acceptance Criteria

1. WHEN a user has a valid JWT cookie, THE System SHALL authenticate the user automatically on page load
2. THE System SHALL provide an endpoint to retrieve the current authenticated user's information
3. WHEN a JWT token expires, THE System SHALL require the user to authenticate again
4. THE System SHALL validate JWT tokens on all protected API endpoints
5. IF a JWT token is invalid or expired, THEN THE System SHALL return an authentication error

### Requirement 12: Location Selection Interface

**User Story:** As a host creating an event, I want to select a location on a map, so that joiners know exactly where the activity will take place.

#### Acceptance Criteria

1. WHEN creating an event, THE System SHALL display an interactive map for location selection
2. WHEN a user clicks on the map, THE System SHALL capture the geographic coordinates of that point
3. WHEN a user selects a location, THE System SHALL display a marker at the selected coordinates
4. THE System SHALL allow users to adjust the selected location by clicking a different point on the map
5. THE System SHALL use Mapbox GL JS for the location selection interface

### Requirement 13: Email Delivery

**User Story:** As a user, I want to receive magic link emails reliably, so that I can access the application.

#### Acceptance Criteria

1. WHERE the application is in production mode, THE System SHALL send magic link emails using the Resend service
2. WHEN sending a magic link email, THE System SHALL include the magic link URL in the email body
3. WHEN sending a magic link email, THE System SHALL include clear instructions for logging in
4. IF email delivery fails, THEN THE System SHALL return an error to the user
5. WHERE the application is in development mode, THE System SHALL log the magic link URL to the console instead of sending an email

### Requirement 14: Data Persistence

**User Story:** As a system administrator, I want all application data stored reliably, so that user information and events are not lost.

#### Acceptance Criteria

1. THE System SHALL use PostgreSQL with PostGIS extension for data storage
2. THE System SHALL use Prisma ORM for database operations
3. WHEN storing event locations, THE System SHALL use the PostGIS geography type with POINT geometry and SRID 4326
4. THE System SHALL maintain referential integrity between users, events, join requests, and messages
5. THE System SHALL automatically set creation timestamps for all entities
6. THE System SHALL automatically update modification timestamps when entities are changed

### Requirement 15: Protected Routes

**User Story:** As a system, I want to ensure only authenticated users can access protected features, so that unauthorized access is prevented.

#### Acceptance Criteria

1. THE System SHALL require authentication for event creation endpoints
2. THE System SHALL require authentication for join request endpoints
3. THE System SHALL require authentication for chat endpoints
4. THE System SHALL require authentication for user profile endpoints
5. THE System SHALL require authentication for block and report endpoints
6. IF an unauthenticated user attempts to access a protected endpoint, THEN THE System SHALL return an authentication error
7. THE System SHALL verify JWT tokens using middleware before processing protected requests
