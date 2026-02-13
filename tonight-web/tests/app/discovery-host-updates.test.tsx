import '../setup-dom';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { DiscoveryList } from '@/app/page';

vi.mock('@/components/tonight/MiniMap', () => ({
  MiniMap: ({ locationName }: { locationName: string }) => (
    <div data-testid={`mini-map-${locationName}`} />
  ),
}));

const baseEvent: any = {
  id: 'evt-1',
  title: 'Host Updates Test',
  description: 'Details that should render',
  datetime: '2026-02-13T00:00:00.000Z',
  locationName: 'Downtown',
  location: { latitude: 42, longitude: 23 },
  maxParticipants: 5,
  distanceMeters: 1200,
  hostLabel: 'Casey Host',
  hostInitials: 'CH',
  hostPhotoUrl: null,
  hostDisplayName: 'Casey Host',
  categoryId: null,
  datetimeLabel: 'Fri 8:00 PM',
  distanceLabel: '2 km away',
  spotsRemaining: 2,
  host: {
    id: 'host-1',
    displayName: 'Casey Host',
    photoUrl: null,
    initials: 'CH',
  },
  availability: {
    maxParticipants: 5,
    acceptedCount: 3,
    spotsRemaining: 2,
  },
};

afterEach(() => {
  cleanup();
});

describe('DiscoveryList host update indicator', () => {
  it('shows the host updates pill when accepted guests have unseen announcements', () => {
    render(
      <DiscoveryList
        events={[
          {
            ...baseEvent,
            viewerJoinRequestStatus: 'ACCEPTED',
            hostUpdatesUnseenCount: 3,
          },
        ]}
        selectedEventId={null}
        onSelect={() => {}}
        locationReady
        radiusSummary="10 km radius"
      />
    );

    expect(screen.getByTestId('host-updates-pill')).toHaveTextContent('3 new host updates');
  });

  it('hides the pill for viewers who are not accepted guests', () => {
    render(
      <DiscoveryList
        events={[
          {
            ...baseEvent,
            id: 'evt-2',
            viewerJoinRequestStatus: 'PENDING',
            hostUpdatesUnseenCount: 5,
          },
        ]}
        selectedEventId={null}
        onSelect={() => {}}
        locationReady
        radiusSummary="10 km radius"
      />
    );

    expect(screen.queryByTestId('host-updates-pill')).toBeNull();
  });
});
