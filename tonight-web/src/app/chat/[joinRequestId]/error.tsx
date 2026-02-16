'use client';

import { useEffect } from 'react';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Chat error:', error);
  }, [error]);

  // Parse error message to show user-friendly text
  let title = 'Chat Unavailable';
  let message = 'This chat could not be loaded.';

  if (error.message.includes('blocked')) {
    title = 'Chat Blocked';
    message = 'This conversation has been blocked.';
  } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
    title = 'No Permission';
    message = "You don't have access to this chat.";
  } else if (error.message.includes('not accepted')) {
    title = 'Waiting for Approval';
    message = 'This chat will be available once your join request is accepted.';
  } else if (error.message.includes('not found')) {
    title = 'Chat Not Found';
    message = 'This chat does not exist.';
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-gray-600">{message}</p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
