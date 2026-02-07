# Implementation Plan: Tonight Meetup App

## Overview

This implementation plan breaks down the Tonight meetup app into discrete, incremental coding tasks. The approach follows a bottom-up strategy: starting with foundational infrastructure (database, authentication), then building core features (events, discovery, join requests), and finally adding real-time chat and safety features. Each task builds on previous work, ensuring no orphaned code.

## Tasks

- [ ] 1. Set up project infrastructure and database
  - Initialize Next.js 14+ project with TypeScript and App Router
  - Configure Tailwind CSS
  - Set up Prisma with PostgreSQL connection
  - Create Prisma schema with all models (User, Event, JoinRequest, Message, BlockedUser, Report, MagicLink)
  - Enable PostGIS extension in PostgreSQL
  - Run initial migration
  - Set up environment variables (.env.example and .env)
  - _Requirements: 14.1, 14.2_

- [ ] 1.1 Write property test for database connection
  - **Property 36: Referential Integrity Enforcement**
  - **Validates: Requirements 14.4**

- [ ] 1.2 Write property test for automatic timestamps
  - **Property 37: Automatic Timestamp Management**
  - **Validates: Requirements 14.5, 14.6**

- [ ] 2. Implement authentication services and middleware
  - [ ] 2.1 Create auth service (lib/auth.ts)
    - Implement generateMagicLinkToken() - 32-byte hex string generation
    - Implement generateJWT(userId) - JWT creation with 7-day expiration
    - Implement verifyJWT(token) - JWT verification and payload extraction
    - _Requirements: 1.1, 1.3, 11.1_

  - [ ] 2.2 Write property tests for auth service
    - **Property 1: Magic Link Token Generation and Expiration**
    - **Validates: Requirements 1.1, 1.2**

  - [ ] 2.3 Write property tests for JWT handling
    - **Property 2: Magic Link Authentication Round Trip**
    - **Property 6: JWT Authentication Round Trip**
    - **Property 7: JWT Expiration Enforcement**
    - **Validates: Requirements 1.3, 1.4, 11.1, 11.2, 11.3, 11.5**

  - [ ] 2.4 Create email service (lib/email.ts)
    - Implement sendMagicLink(email, token) with Resend integration
    - Add development mode console logging
    - Create email template with magic link and instructions
    - _Requirements: 1.1, 1.8, 13.1, 13.2, 13.3_

  - [ ] 2.5 Write property tests for email service
    - **Property 39: Magic Link Email Content**
    - **Property 40: Email Delivery Error Handling**
    - **Validates: Requirements 13.2, 13.3, 13.4**

  - [ ] 2.6 Create auth middleware (middleware/auth.ts)
    - Implement requireAuth() wrapper for protected routes
    - Implement getCurrentUser() for extracting user from JWT
    - _Requirements: 11.4, 15.7_

  - [ ] 2.7 Write property test for protected endpoint authentication
    - **Property 8: Protected Endpoint Authentication**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6**

- [ ] 3. Implement authentication API routes
  - [ ] 3.1 Create POST /api/auth/request-magic-link
    - Validate email format
    - Generate magic link token
    - Store MagicLink record with 15-minute expiration
    - Send email via email service
    - Return success response
    - _Requirements: 1.1, 1.2_

  - [ ] 3.2 Write property tests for magic link request
    - **Property 1: Magic Link Token Generation and Expiration**
    - **Property 3: Expired Token Rejection**
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [ ] 3.3 Create GET /api/auth/verify
    - Validate token exists and not expired
    - Check token not already used
    - Mark token as used
    - Create or retrieve User record
    - Generate JWT and set httpOnly cookie
    - Redirect to home page
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.1_

  - [ ] 3.4 Write property tests for token verification
    - **Property 2: Magic Link Authentication Round Trip**
    - **Property 4: Single-Use Token Enforcement**
    - **Property 9: First Authentication User Creation**
    - **Validates: Requirements 1.3, 1.4, 1.6, 2.1**

  - [ ] 3.5 Create GET /api/auth/me
    - Use auth middleware to get current user
    - Return user data or null
    - _Requirements: 11.2_

  - [ ] 3.6 Create POST /api/auth/logout
    - Clear authentication cookie
    - Return success response
    - _Requirements: 1.7_

  - [ ] 3.7 Write property test for logout
    - **Property 5: Logout Cookie Clearing**
    - **Validates: Requirements 1.7**

- [ ] 4. Checkpoint - Ensure authentication tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement user profile functionality
  - [ ] 5.1 Create PATCH /api/users/me
    - Use auth middleware for authentication
    - Validate displayName and photoUrl
    - Update user profile
    - Return updated user data
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 5.2 Write property test for profile updates
    - **Property 10: Profile Update Round Trip**
    - **Property 11: Profile Creation Timestamp**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

  - [ ] 5.3 Create profile page (app/profile/page.tsx)
    - Display user information (email, displayName, photoUrl, createdAt)
    - Add form for editing displayName
    - Add photo upload functionality
    - _Requirements: 2.5, 2.6_

  - [ ] 5.4 Create UserAvatar component (components/UserAvatar.tsx)
    - Display profile photo or initials fallback
    - Support multiple size variants
    - _Requirements: 2.3_

- [ ] 6. Implement geospatial service
  - [ ] 6.1 Create geospatial service (lib/geospatial.ts)
    - Implement findNearbyEvents(lat, lng, radiusMeters, userId)
    - Use PostGIS ST_DWithin for radius query
    - Calculate distance with ST_Distance
    - Filter by status = "active"
    - Exclude events from blocked users (bidirectional)
    - Order by distance ascending
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 6.2 Write property tests for geospatial queries
    - **Property 18: Radius-Based Event Discovery**
    - **Property 19: Default Radius Application**
    - **Property 20: Distance Calculation and Inclusion**
    - **Property 21: Distance-Based Result Ordering**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [ ] 7. Implement event creation and management
  - [ ] 7.1 Create POST /api/events
    - Use auth middleware for authentication
    - Validate event data (title, description, datetime, location, locationName)
    - Validate datetime is in future
    - Create event with PostGIS POINT (SRID 4326)
    - Set status to "active"
    - Default maxParticipants to 2 if not specified
    - Return created event
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 7.2 Write property tests for event creation
    - **Property 12: Event Creation with All Fields**
    - **Property 13: Location Storage as PostGIS Point**
    - **Property 14: Max Participants Default Value**
    - **Property 15: Future Datetime Validation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

  - [ ] 7.3 Create GET /api/events/[id]
    - Fetch event by ID
    - Include host information
    - Return 404 if not found
    - _Requirements: 3.1_

  - [ ] 7.4 Implement event expiration logic
    - Add utility function to check and mark expired events
    - Call before discovery queries
    - _Requirements: 4.1, 4.2_

  - [ ] 7.5 Write property tests for event expiration
    - **Property 16: Automatic Event Expiration**
    - **Property 17: Expired Event Exclusion from Discovery**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 8. Implement event discovery API
  - [ ] 8.1 Create GET /api/events/nearby
    - Use auth middleware for authentication
    - Extract lat, lng, radius from query params
    - Default radius to 10000 meters
    - Call geospatial service findNearbyEvents
    - Return events with distances
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [ ] 8.2 Write integration tests for discovery API
    - Test with various locations and radii
    - Test blocking scenarios
    - Test expired event filtering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 9. Checkpoint - Ensure event tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Mapbox integration
  - [ ] 10.1 Set up Mapbox configuration
    - Add Mapbox access token to environment variables
    - Install mapbox-gl and @types/mapbox-gl
    - _Requirements: 6.2, 12.5_

  - [ ] 10.2 Create MapboxLocationPicker component (components/MapboxLocationPicker.tsx)
    - Initialize Mapbox map
    - Handle map clicks to capture coordinates
    - Display marker at selected location
    - Allow updating location by clicking different point
    - Emit selected coordinates to parent
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ] 10.3 Write property test for coordinate capture
    - **Property 38: Map Click Coordinate Capture**
    - **Validates: Requirements 12.2, 12.4**

  - [ ] 10.4 Create EventMapView component (components/EventMapView.tsx)
    - Initialize Mapbox map
    - Display event markers with popups
    - Display user location marker
    - Handle marker clicks for event details
    - _Requirements: 6.1, 6.2_

  - [ ] 10.5 Create EventListView component (components/EventListView.tsx)
    - Display list of event cards
    - Show title, datetime, location name, distance for each event
    - Handle click to view event details
    - _Requirements: 6.3, 6.4_

  - [ ] 10.6 Write property test for list view fields
    - **Property 22: List View Required Fields**
    - **Validates: Requirements 6.4**

- [ ] 11. Implement event creation and discovery pages
  - [ ] 11.1 Create event creation page (app/events/create/page.tsx)
    - Add form for title, description, datetime
    - Integrate MapboxLocationPicker for location selection
    - Add location name input
    - Handle form submission to POST /api/events
    - Redirect to home on success
    - _Requirements: 3.1, 12.1_

  - [ ] 11.2 Create home/discovery page (app/page.tsx)
    - Get user's current location
    - Fetch nearby events from GET /api/events/nearby
    - Toggle between EventMapView and EventListView
    - Add button to create new event
    - _Requirements: 5.1, 6.1, 6.3, 6.5_

  - [ ] 11.3 Create EventDetailModal component (components/EventDetailModal.tsx)
    - Display event information (title, description, datetime, location)
    - Display host information
    - Add "Request to Join" button
    - _Requirements: 3.1_

- [ ] 12. Implement join request functionality
  - [ ] 12.1 Create POST /api/join-requests
    - Use auth middleware for authentication
    - Validate event exists and is active
    - Check user hasn't already requested to join
    - Check max participants not exceeded
    - Create join request with status "pending"
    - Return created join request
    - _Requirements: 7.1, 7.2, 7.7_

  - [ ] 12.2 Write property tests for join request creation
    - **Property 23: Join Request Creation with Pending Status**
    - **Property 24: Duplicate Join Request Prevention**
    - **Property 26: Max Participants Enforcement**
    - **Validates: Requirements 7.1, 7.2, 7.7**

  - [ ] 12.3 Create PATCH /api/join-requests/[id]
    - Use auth middleware for authentication
    - Validate user is event host
    - Validate status is "accepted" or "rejected"
    - Update join request status
    - Return updated join request
    - _Requirements: 7.4, 7.5, 7.6_

  - [ ] 12.4 Write property test for join request status transitions
    - **Property 25: Join Request Status Transitions**
    - **Validates: Requirements 7.4, 7.5, 7.6**

  - [ ] 12.5 Create GET /api/join-requests/for-event/[eventId]
    - Use auth middleware for authentication
    - Validate user is event host
    - Fetch all join requests for event
    - Return join requests with user information
    - _Requirements: 7.4_

  - [ ] 12.6 Add join request handling to EventDetailModal
    - Call POST /api/join-requests when "Request to Join" clicked
    - Show success/error messages
    - _Requirements: 7.1_

  - [ ] 12.7 Create join requests management page (app/events/[id]/requests/page.tsx)
    - Display all join requests for host's event
    - Add accept/reject buttons for pending requests
    - Call PATCH /api/join-requests/[id] on accept/reject
    - _Requirements: 7.4, 7.5, 7.6_

- [ ] 13. Checkpoint - Ensure join request tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement Socket.IO for real-time chat
  - [ ] 14.1 Create Socket.IO service (lib/socket.ts)
    - Initialize Socket.IO server
    - Configure CORS for Next.js
    - Implement connection handler with JWT authentication
    - Implement room joining based on joinRequestId
    - Implement emitMessage(joinRequestId, message) to broadcast to room
    - _Requirements: 8.3, 8.6_

  - [ ] 14.2 Set up Socket.IO server in Next.js
    - Create custom server file or use Next.js API route for Socket.IO
    - Initialize Socket.IO service
    - _Requirements: 8.3, 8.6_

  - [ ] 14.3 Create Socket.IO client hook (hooks/useSocket.ts)
    - Connect to Socket.IO server with JWT
    - Handle connection/disconnection
    - Provide methods to join room and send messages
    - Handle incoming messages
    - _Requirements: 8.3_

- [ ] 15. Implement chat functionality
  - [ ] 15.1 Create GET /api/chat/[joinRequestId]/messages
    - Use auth middleware for authentication
    - Validate user is host or joiner
    - Validate join request status is "accepted"
    - Fetch all messages for join request ordered by timestamp
    - Return messages
    - _Requirements: 8.2, 8.5_

  - [ ] 15.2 Write property tests for chat access control
    - **Property 27: Chat Access Control for Accepted Requests**
    - **Property 28: Chat Access Denial for Non-Accepted Requests**
    - **Validates: Requirements 8.1, 8.2**

  - [ ] 15.3 Create POST /api/chat/[joinRequestId]/messages
    - Use auth middleware for authentication
    - Validate user is host or joiner
    - Validate join request status is "accepted"
    - Create message record with sender, content, timestamp
    - Emit message via Socket.IO to room
    - Return created message
    - _Requirements: 8.1, 8.3, 8.4, 8.7_

  - [ ] 15.4 Write property tests for message storage and delivery
    - **Property 29: Message Storage Round Trip**
    - **Property 30: Real-Time Message Delivery**
    - **Validates: Requirements 8.3, 8.4, 8.5, 8.7**

  - [ ] 15.5 Create chat page (app/chat/[joinRequestId]/page.tsx)
    - Use useSocket hook to connect to Socket.IO
    - Fetch message history from GET /api/chat/[joinRequestId]/messages
    - Display messages in MessageList component
    - Add message input form
    - Send messages via POST /api/chat/[joinRequestId]/messages
    - Listen for real-time messages via Socket.IO
    - _Requirements: 8.1, 8.3, 8.5_

  - [ ] 15.6 Create MessageList component (components/MessageList.tsx)
    - Display scrollable message container
    - Render message bubbles with sent/received styling
    - Display timestamps
    - Auto-scroll to bottom on new messages
    - _Requirements: 8.5_

- [ ] 16. Implement blocking functionality
  - [ ] 16.1 Create POST /api/users/block
    - Use auth middleware for authentication
    - Validate userId provided
    - Create BlockedUser record
    - Prevent duplicate blocks
    - Return success response
    - _Requirements: 9.1, 9.2, 9.6_

  - [ ] 16.2 Write property tests for blocking
    - **Property 31: Block Record Creation**
    - **Property 32: Bidirectional Event Discovery Blocking**
    - **Property 33: Message Blocking**
    - **Property 34: Duplicate Block Prevention**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

  - [ ] 16.3 Update geospatial service to filter blocked users
    - Modify findNearbyEvents to exclude events from blocked users
    - Exclude events where user is blocked by host
    - _Requirements: 5.4, 5.5, 9.3, 9.4_

  - [ ] 16.4 Update chat endpoints to check blocking
    - Prevent message sending if users have blocked each other
    - Return 403 Forbidden if blocked
    - _Requirements: 9.5_

  - [ ] 16.5 Create BlockUserButton component (components/BlockUserButton.tsx)
    - Display block button
    - Show confirmation dialog
    - Call POST /api/users/block on confirm
    - _Requirements: 9.1_

  - [ ] 16.6 Add BlockUserButton to user profile and chat pages
    - _Requirements: 9.1_

- [ ] 17. Implement reporting functionality
  - [ ] 17.1 Create POST /api/reports
    - Use auth middleware for authentication
    - Validate either eventId or reportedUserId provided
    - Create report with status "pending"
    - Store reporter, reported entity, reason, description
    - Return created report
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 17.2 Write property test for report creation
    - **Property 35: Report Creation Round Trip**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

  - [ ] 17.3 Create ReportModal component (components/ReportModal.tsx)
    - Display report form with reason and description fields
    - Handle form submission to POST /api/reports
    - Show success/error messages
    - _Requirements: 10.1, 10.2_

  - [ ] 17.4 Add report functionality to event and user pages
    - Add "Report" button to EventDetailModal
    - Add "Report" button to user profiles
    - Open ReportModal on click
    - _Requirements: 10.1, 10.2_

- [ ] 18. Implement authentication UI
  - [ ] 18.1 Create login page (app/login/page.tsx)
    - Add email input form
    - Call POST /api/auth/request-magic-link on submit
    - Display success message ("Check your email")
    - Display error messages
    - _Requirements: 1.1_

  - [ ] 18.2 Create AuthProvider component (components/AuthProvider.tsx)
    - Create React Context for authentication state
    - Fetch current user from GET /api/auth/me on mount
    - Provide user data and logout function to children
    - Handle loading and error states
    - _Requirements: 11.1, 11.2_

  - [ ] 18.3 Wrap app with AuthProvider
    - Update app/layout.tsx to include AuthProvider
    - _Requirements: 11.1_

  - [ ] 18.4 Add protected route logic
    - Create useAuth hook to access auth context
    - Redirect to login if not authenticated on protected pages
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit, property, integration, UI tests)
  - Verify all 40 properties are tested
  - Ensure test coverage meets 80%+ target
  - Fix any failing tests
  - Ask the user if questions arise.

- [ ] 20. Polish and error handling
  - [ ] 20.1 Add comprehensive error handling to all API routes
    - Implement error response formatting
    - Add appropriate HTTP status codes
    - Log errors server-side
    - _Requirements: All error handling requirements_

  - [ ] 20.2 Add loading states to all pages
    - Display spinners during data fetching
    - Disable buttons during form submission
    - _Requirements: User experience_

  - [ ] 20.3 Add success/error toast notifications
    - Install toast library (e.g., react-hot-toast)
    - Add toasts for all user actions
    - _Requirements: User experience_

  - [ ] 20.4 Implement WebSocket reconnection logic
    - Add exponential backoff for reconnection
    - Display connection status to user
    - Queue messages during disconnection
    - _Requirements: 8.3_

  - [ ] 20.5 Add mobile-responsive styling
    - Test on mobile viewport sizes
    - Adjust layouts for small screens
    - Ensure touch targets are appropriately sized
    - _Requirements: Mobile-first design_

- [ ] 21. Write UI tests
  - Test that pages render correctly
  - Test that key components render
  - Test that forms are functional
  - _Requirements: Testing strategy_

## Notes

- All tasks are required for comprehensive testing and quality assurance
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (40 total properties)
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: infrastructure → core features → real-time features → safety features
- All code should be written in TypeScript for type safety
- Use fast-check library for property-based testing with minimum 100 iterations per test
