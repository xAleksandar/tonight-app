"use client"

import { useState } from "react"
import { WelcomeScreen } from "@/components/tonight/welcome-screen"
import { DiscoverScreen } from "@/components/tonight/discover-screen"
import { CreateEventScreen } from "@/components/tonight/create-event-screen"
import { EventDetailScreen } from "@/components/tonight/event-detail-screen"
import { MessagesScreen } from "@/components/tonight/messages-screen"
import { ChatScreen } from "@/components/tonight/chat-screen"
import { ProfileScreen } from "@/components/tonight/profile-screen"
import { PeopleScreen } from "@/components/tonight/people-screen"
import { BottomNav, type Screen } from "@/components/tonight/bottom-nav"
import { DesktopSidebar } from "@/components/tonight/desktop-sidebar"
import { DesktopHeader } from "@/components/tonight/desktop-header"

const screenTitles: Partial<Record<Screen, { title: string; subtitle?: string }>> = {
  discover: { title: "Discover", subtitle: "Events near you" },
  people: { title: "People Nearby", subtitle: "Discover who's planning something" },
  create: { title: "Create Event", subtitle: "Share what you're up to tonight" },
  messages: { title: "Messages", subtitle: "Your join requests and chats" },
  profile: { title: "Profile" },
  "event-detail": { title: "Event Details" },
  chat: { title: "Chat" },
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  function handleLogin() {
    setIsLoggedIn(true)
    setScreen("discover")
  }

  function handleLogout() {
    setIsLoggedIn(false)
    setScreen("welcome")
  }

  if (!isLoggedIn) {
    return <WelcomeScreen onLogin={handleLogin} />
  }

  const currentScreen = screenTitles[screen]
  const showSidebar = screen !== "chat"

  return (
    <>
      {/* Mobile layout */}
      <div className="flex min-h-dvh flex-col md:hidden">
        <main className="flex-1">
          {screen === "discover" && <DiscoverScreen onNavigate={setScreen} />}
          {screen === "people" && <PeopleScreen onNavigate={setScreen} />}
          {screen === "create" && <CreateEventScreen onNavigate={setScreen} />}
          {screen === "messages" && <MessagesScreen onNavigate={setScreen} />}
          {screen === "chat" && <ChatScreen onNavigate={setScreen} />}
          {screen === "event-detail" && <EventDetailScreen onNavigate={setScreen} />}
          {screen === "profile" && <ProfileScreen onLogout={handleLogout} />}
        </main>
        {screen !== "chat" && (
          <BottomNav activeScreen={screen} onNavigate={setScreen} unreadCount={2} />
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden min-h-dvh md:flex">
        {showSidebar && (
          <DesktopSidebar
            activeScreen={screen}
            onNavigate={setScreen}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        )}
        <div className="flex flex-1 flex-col overflow-hidden">
          {currentScreen && screen !== "chat" && (
            <DesktopHeader
              activeScreen={screen}
              onNavigate={setScreen}
              unreadCount={2}
              title={currentScreen.title}
              subtitle={currentScreen.subtitle}
            />
          )}
          <main
            className="flex-1"
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {screen === "discover" && (
              <DiscoverScreen
                onNavigate={setScreen}
                isDesktop
                desktopCategory={selectedCategory}
              />
            )}
            {screen === "people" && <PeopleScreen onNavigate={setScreen} isDesktop />}
            {screen === "create" && (
              <div className="mx-auto max-w-2xl">
                <CreateEventScreen onNavigate={setScreen} isDesktop />
              </div>
            )}
            {screen === "messages" && (
              <div className="mx-auto max-w-2xl">
                <MessagesScreen onNavigate={setScreen} isDesktop />
              </div>
            )}
            {screen === "chat" && <ChatScreen onNavigate={setScreen} />}
            {screen === "event-detail" && (
              <div className="mx-auto max-w-2xl">
                <EventDetailScreen onNavigate={setScreen} isDesktop />
              </div>
            )}
            {screen === "profile" && (
              <div className="mx-auto max-w-2xl">
                <ProfileScreen onLogout={handleLogout} isDesktop />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
