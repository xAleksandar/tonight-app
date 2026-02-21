/**
 * Chat rate limiter to prevent message spam
 *
 * Limits users to a maximum number of messages per time window.
 * Default: 20 messages per 60 seconds (1 minute)
 */
class ChatRateLimiter {
  private userMessages = new Map<string, number[]>(); // userId -> timestamps
  private readonly maxMessages: number;
  private readonly windowMs: number;

  constructor(maxMessages = 20, windowMs = 60000) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
  }

  /**
   * Check if user can send a message
   * @param userId - User ID to check
   * @returns true if user can send, false if rate limited
   */
  canSendMessage(userId: string): boolean {
    const now = Date.now();
    const timestamps = this.userMessages.get(userId) || [];

    // Remove timestamps outside the time window
    const recentTimestamps = timestamps.filter(t => now - t < this.windowMs);

    // Check if user exceeded limit
    if (recentTimestamps.length >= this.maxMessages) {
      this.userMessages.set(userId, recentTimestamps);
      return false;
    }

    // Add current timestamp and allow message
    recentTimestamps.push(now);
    this.userMessages.set(userId, recentTimestamps);
    return true;
  }

  /**
   * Get remaining messages user can send in current window
   * @param userId - User ID to check
   * @returns Number of messages remaining
   */
  getRemainingMessages(userId: string): number {
    const now = Date.now();
    const timestamps = this.userMessages.get(userId) || [];
    const recentTimestamps = timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxMessages - recentTimestamps.length);
  }

  /**
   * Get seconds until user can send next message
   * @param userId - User ID to check
   * @returns Seconds until rate limit resets (0 if not rate limited)
   */
  getSecondsUntilReset(userId: string): number {
    const now = Date.now();
    const timestamps = this.userMessages.get(userId) || [];
    const recentTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (recentTimestamps.length < this.maxMessages) {
      return 0;
    }

    // Find oldest timestamp in window
    const oldestTimestamp = Math.min(...recentTimestamps);
    const resetTime = oldestTimestamp + this.windowMs;
    return Math.ceil((resetTime - now) / 1000);
  }

  /**
   * Clear rate limit data for a user
   * @param userId - User ID to clear
   */
  clearUser(userId: string): void {
    this.userMessages.delete(userId);
  }

  /**
   * Cleanup old data (run periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [userId, timestamps] of this.userMessages.entries()) {
      const recent = timestamps.filter(t => now - t < this.windowMs);
      if (recent.length === 0) {
        this.userMessages.delete(userId);
      } else {
        this.userMessages.set(userId, recent);
      }
    }
  }
}

// Singleton instance
export const chatRateLimiter = new ChatRateLimiter(20, 60000);

// Cleanup every 5 minutes
setInterval(() => chatRateLimiter.cleanup(), 5 * 60 * 1000);
