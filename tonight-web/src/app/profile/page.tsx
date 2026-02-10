'use client';

import { Fragment, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Camera,
  ChevronRight,
  Clapperboard,
  Flag,
  LogOut,
  Mail,
  MapPin,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import BlockUserButton from '@/components/BlockUserButton';
import ReportModal from '@/components/ReportModal';
import UserAvatar from '@/components/UserAvatar';
import { AuthStatusMessage } from '@/components/auth/AuthStatusMessage';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { DesktopHeader } from '@/components/tonight/DesktopHeader';
import { DesktopSidebar } from '@/components/tonight/DesktopSidebar';
import { MobileActionBar } from '@/components/tonight/MobileActionBar';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { CategoryId } from '@/lib/categories';
import { classNames } from '@/lib/classNames';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

const FORM_INPUT_CLASS =
  'h-12 w-full rounded-2xl border border-border/70 bg-background/40 px-4 text-sm text-foreground placeholder:text-muted-foreground shadow-inner shadow-black/10 transition focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none';

const CTA_BUTTON_CLASS =
  'inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_20px_45px_rgba(14,34,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto';

const SECONDARY_BUTTON_CLASS =
  'inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-background/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40';

type ProfileResponse = {
  user: Profile | null;
};

type Profile = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  createdAt: string;
};

type StatusState = {
  type: 'success' | 'error';
  message: string;
};

type ProfileOverviewResponse = {
  stats: ProfileStats;
  activeEvents: ActiveEventSummary[];
};

type ProfileStats = {
  eventsHosted: number;
  eventsJoined: number;
  peopleMet: number;
};

type ActiveEventSummary = {
  id: string;
  title: string;
  datetime: string;
  locationName: string;
  status: string;
  pendingRequests: number;
  acceptedRequests: number;
};

const formatDate = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return 'Unknown';
  }
};

const formatMonthYear = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return 'Unknown';
  }
};

const formatEventDatetime = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return 'Soon';
  }
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });

const sanitize = (value: string) => value.trim();

export default function ProfilePage() {
  const { status: authStatus, user: authUser } = useRequireAuth();

  if (authStatus === 'loading') {
    return <AuthStatusMessage label="Checking your session…" />;
  }

  if (authStatus === 'unauthenticated') {
    return <AuthStatusMessage label="Redirecting you to the welcome screen…" />;
  }

  if (authStatus === 'error') {
    return <AuthStatusMessage label="We couldn't verify your session. Refresh to try again." />;
  }

  return <AuthenticatedProfilePage currentUserId={authUser?.id ?? null} />;
}

type AuthenticatedProfilePageProps = {
  currentUserId: string | null;
};

function AuthenticatedProfilePage({ currentUserId }: AuthenticatedProfilePageProps) {
  const router = useRouter();
  const { logout } = useAuthContext();
  const [sidebarCategory, setSidebarCategory] = useState<CategoryId | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<ProfileOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const safetyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const payload = (await response.json()) as ProfileResponse;
        if (!isMounted) return;
        setProfile(payload.user);
        setDisplayNameInput(payload.user?.displayName ?? '');
        setPhotoInput(payload.user?.photoUrl ?? '');
      } catch (error) {
        console.error('Failed to load profile', error);
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const response = await fetch('/api/profile/overview', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load profile overview');
      }
      const payload = (await response.json()) as ProfileOverviewResponse;
      setOverview(payload);
      setOverviewError(null);
    } catch (error) {
      console.error('Failed to load profile overview', error);
      setOverview(null);
      setOverviewError('Unable to load your event activity right now. Try again shortly.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview().catch((error) => {
      console.error('Unexpected overview failure', error);
    });
  }, [fetchOverview]);

  useEffect(() => {
    setReportNotice(null);
    setReportModalOpen(false);
  }, [profile?.id]);

  const initialDisplayName = profile?.displayName ?? '';
  const initialPhoto = profile?.photoUrl ?? '';

  const viewingOwnProfile = !currentUserId || (profile ? profile.id === currentUserId : true);
  const canReportUser = Boolean(profile && currentUserId && profile.id !== currentUserId);

  const hasDisplayNameChange = displayNameInput !== initialDisplayName;
  const hasPhotoChange = photoInput !== initialPhoto;
  const hasChanges = hasDisplayNameChange || hasPhotoChange;

  const currentPhotoPreview = photoInput || initialPhoto || undefined;

  const handleFileSelection = useCallback(async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoInput(dataUrl);
      setStatus({ type: 'success', message: 'Photo ready to upload' });
      showSuccessToast('Photo ready', 'Remember to save your changes.');
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Could not read that file' });
      showErrorToast('Unable to read file', 'Pick a different image to continue.');
    }
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      const message = 'You need to sign in to update your profile.';
      setStatus({ type: 'error', message });
      showErrorToast('Sign in required', message);
      return;
    }

    if (!hasChanges) {
      const message = 'No changes to save.';
      setStatus({ type: 'error', message });
      showErrorToast('Nothing to update', 'Make an edit before saving.');
      return;
    }

    const payload: Record<string, string | null> = {};
    if (hasDisplayNameChange) {
      const value = sanitize(displayNameInput);
      payload.displayName = value.length === 0 ? null : value;
    }

    if (hasPhotoChange) {
      const value = photoInput.trim();
      payload.photoUrl = value.length === 0 ? null : value;
    }

    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error ?? 'Unable to save your profile.';
        setStatus({
          type: 'error',
          message,
        });
        showErrorToast('Profile update failed', message);
        return;
      }

      setProfile(data.user);
      setDisplayNameInput(data.user.displayName ?? '');
      setPhotoInput(data.user.photoUrl ?? '');
      setStatus({ type: 'success', message: 'Profile updated successfully.' });
      showSuccessToast('Profile updated', 'Your changes are live.');
      fetchOverview().catch((error) => {
        console.error('Failed to refresh overview', error);
      });
    } catch (error) {
      console.error('Failed to update profile', error);
      const message = 'Unexpected error while saving changes.';
      setStatus({ type: 'error', message });
      showErrorToast('Unexpected error', message);
    } finally {
      setSaving(false);
    }
  };

  const resetPhoto = () => {
    setPhotoInput(initialPhoto);
  };

  const removePhoto = () => {
    setPhotoInput('');
  };

  const statusStyles = useMemo(() => {
    if (!status) return '';
    return status.type === 'success' ? 'text-emerald-300' : 'text-rose-300';
  }, [status]);

  const stats = overview?.stats ?? { eventsHosted: 0, eventsJoined: 0, peopleMet: 0 };

  const settingsRows: SettingsRowConfig[] = [
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => showSuccessToast('Coming soon', 'Settings panel will live here soon.'),
    },
    {
      icon: Shield,
      label: 'Safety & privacy',
      onClick: () => safetyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    {
      icon: LogOut,
      label: 'Sign out',
      variant: 'destructive',
      onClick: () => logout().catch((error) => console.error('Failed to log out', error)),
    },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#101227] via-[#0f1324] to-[#050814] text-foreground">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <DesktopSidebar
          selectedCategory={sidebarCategory}
          onCategoryChange={setSidebarCategory}
          onCreate={() => router.push('/events/create')}
          onNavigateDiscover={() => router.push('/')}
          onNavigatePeople={() => router.push('/people')}
        />

        <div className="flex flex-1 flex-col">
          <DesktopHeader
            title="Profile"
            subtitle="Keep your Tonight identity current"
            onNavigateProfile={() => router.push('/profile')}
          />

          <main className="flex-1 px-4 pb-28 pt-4 md:px-10 md:pb-12 md:pt-8">
            <div className="mx-auto w-full max-w-5xl space-y-6">
              <ProfileMobileHero />

              {loading ? (
                <ProfilePageSkeleton />
              ) : !profile ? (
                <div className="rounded-3xl border border-rose-200/30 bg-rose-500/10 p-6 text-sm text-rose-50 shadow-xl shadow-rose-900/20">
                  We couldn’t load your profile. Try signing in again.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl shadow-black/20">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="relative">
                          <UserAvatar
                            displayName={profile.displayName}
                            email={profile.email}
                            photoUrl={currentPhotoPreview}
                            size="xl"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-lg"
                            aria-label="Change photo"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-xl font-bold text-foreground">{profile.displayName ?? 'Add your name'}</h2>
                          <p className="text-xs text-muted-foreground">Edit your display name</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                          {[
                            { label: 'Events posted', value: stats.eventsHosted },
                            { label: 'Events joined', value: stats.eventsJoined },
                            { label: 'People met', value: stats.peopleMet },
                          ].map((stat, index, array) => (
                            <Fragment key={stat.label}>
                              <StatItem label={stat.label} value={stat.value} />
                              {index < array.length - 1 ? (
                                <div className="h-8 w-px bg-border/60" aria-hidden="true" />
                              ) : null}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-border/60 bg-card/60 divide-y divide-border/50">
                      <InfoRow
                        icon={Mail}
                        label="Email"
                        value={profile.email}
                        helper="Used for sign-in, safety alerts, and Tonight notifications."
                      />
                      <InfoRow
                        icon={Calendar}
                        label="Joined"
                        value={formatMonthYear(profile.createdAt)}
                        helper="When you first created your Tonight account."
                      />
                      <InfoRow
                        icon={MapPin}
                        label="Location"
                        value="Grant access from Discover"
                        helper="Share your general area from the Discover screen to improve local matches."
                        isAction
                      />
                    </section>

                    <ActiveEventsPanel
                      loading={overviewLoading}
                      error={overviewError}
                      events={overview?.activeEvents ?? []}
                    />

                    <section className="rounded-3xl border border-border/60 bg-card/60">
                      {settingsRows.map((row) => (
                        <SettingsRow key={row.label} {...row} />
                      ))}
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl shadow-black/20">
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Profile</p>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h3 className="font-serif text-2xl font-semibold">Personal details</h3>
                            <p className="text-sm text-muted-foreground">
                              Keep the name and photo that hosts see aligned with the Tonight spec.
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground sm:text-right">
                            Visible on your event cards, chat requests, and profile.
                          </p>
                        </div>
                      </div>
                      <form className="mt-8 space-y-8" onSubmit={onSubmit}>
                        <div className="space-y-3">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <label
                              htmlFor="profile-display-name"
                              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              Display name
                            </label>
                            <p className="text-xs text-muted-foreground">2–64 characters, no emojis.</p>
                          </div>
                          <input
                            id="profile-display-name"
                            type="text"
                            value={displayNameInput}
                            onChange={(event) => setDisplayNameInput(event.target.value)}
                            placeholder="Add a friendly name"
                            className={FORM_INPUT_CLASS}
                          />
                          <p className="text-xs text-muted-foreground">
                            This is shown to people you host or request to join.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <label
                              htmlFor="profile-photo-url"
                              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              Photo
                            </label>
                            <p className="text-xs text-muted-foreground">Square images look best across Tonight.</p>
                          </div>
                          <input
                            id="profile-photo-url"
                            type="url"
                            value={photoInput}
                            onChange={(event) => setPhotoInput(event.target.value)}
                            placeholder="https://example.com/photo.jpg"
                            className={FORM_INPUT_CLASS}
                          />
                          <div className="flex flex-wrap gap-2 text-sm">
                            <button
                              type="button"
                              className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 font-semibold text-primary transition hover:bg-primary/15"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Upload photo
                            </button>
                            <button
                              type="button"
                              onClick={removePhoto}
                              className="rounded-full border border-transparent px-4 py-2 font-semibold text-muted-foreground transition hover:border-border/50 hover:bg-background/40"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={resetPhoto}
                              className="rounded-full border border-transparent px-4 py-2 font-semibold text-muted-foreground transition hover:border-border/50 hover:bg-background/40"
                            >
                              Reset
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Paste a public URL or upload a new image. Images stay local until you hit “Save changes.”
                          </p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void handleFileSelection(file);
                                event.target.value = '';
                              }
                            }}
                          />
                        </div>

                        {status ? <p className={classNames('text-sm font-semibold', statusStyles)}>{status.message}</p> : null}

                        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                          <button type="submit" disabled={!hasChanges || saving} className={CTA_BUTTON_CLASS}>
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                          <button
                            type="button"
                            disabled={!hasChanges || saving}
                            className={SECONDARY_BUTTON_CLASS}
                            onClick={() => {
                              setDisplayNameInput(initialDisplayName);
                              setPhotoInput(initialPhoto);
                              setStatus(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </section>

                    <section
                      ref={safetyRef}
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl shadow-black/20"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Safety</p>
                          <h3 className="font-serif text-xl font-semibold text-foreground">Block & report</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Block or report someone if they make you uncomfortable. Safety notes stay private with the Tonight team.
                          </p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
                              Blocks hide chats, join requests, and future invites instantly.
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-400/70" aria-hidden="true" />
                              Reports alert Tonight’s safety team discreetly for review.
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <BlockUserButton
                          targetUserId={profile.id}
                          targetDisplayName={profile.displayName ?? profile.email}
                          className="w-full"
                          variant="panel"
                          confirmTitle={profile.displayName ? `Block ${profile.displayName}?` : 'Block this user?'}
                          confirmMessage="They won’t be able to message you, join your events, or see your plans."
                          disabled={viewingOwnProfile}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!canReportUser) return;
                            setReportModalOpen(true);
                          }}
                          disabled={!canReportUser}
                          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:border-rose-200/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span>Report user</span>
                          <Flag className="h-4 w-4" />
                        </button>
                      </div>
                      <p
                        className={classNames(
                          'mt-4 rounded-2xl border px-4 py-3 text-xs leading-relaxed',
                          reportNotice
                            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-50'
                            : 'border-border/60 bg-background/30 text-muted-foreground'
                        )}
                      >
                        {reportNotice
                          ? reportNotice
                          : viewingOwnProfile
                            ? 'Viewing your own profile. Visit another person’s profile to manage safety settings.'
                            : 'Reports alert Tonight’s safety team discreetly. Share details if something feels off.'}
                      </p>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <MobileActionBar
        active="profile"
        onNavigateDiscover={() => router.push('/')}
        onNavigatePeople={() => router.push('/people')}
        onCreate={() => router.push('/events/create')}
        onOpenProfile={() => router.push('/profile')}
      />

      {profile ? (
        <ReportModal
          isOpen={Boolean(reportModalOpen && canReportUser)}
          target={{
            type: 'user',
            userId: profile.id,
            displayName: profile.displayName ?? profile.email,
            subtitle: profile.email,
          }}
          onClose={() => setReportModalOpen(false)}
          onSubmitted={() => {
            setReportNotice('Thanks for speaking up. Our safety team will review ASAP.');
            setReportModalOpen(false);
          }}
          titleOverride={profile.displayName ? `Report ${profile.displayName}` : undefined}
        />
      ) : null}
    </div>
  );
}

type StatItemProps = {
  label: string;
  value: number;
};

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

type InfoRowProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  isAction?: boolean;
};

function InfoRow({ icon: Icon, label, value, helper, isAction = false }: InfoRowProps) {
  return (
    <div className="flex items-start gap-4 px-5 py-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/40 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <span
            className={classNames(
              'text-sm font-semibold sm:ml-auto',
              isAction ? 'text-primary' : 'text-foreground'
            )}
          >
            {value}
          </span>
        </div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </div>
    </div>
  );
}

type ActiveEventsPanelProps = {
  loading: boolean;
  error: string | null;
  events: ActiveEventSummary[];
};

function ActiveEventsPanel({ loading, error, events }: ActiveEventsPanelProps) {
  const hasEvents = events.length > 0;

  return (
    <section className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">Hosts</p>
          <h3 className="font-serif text-xl font-semibold text-foreground">Active plans</h3>
          <p className="text-xs text-muted-foreground">Keep an eye on pending requests and RSVP health.</p>
        </div>
        {!loading && !error && hasEvents ? (
          <p className="text-xs text-muted-foreground/80">Updates land here as guests respond.</p>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-border/40 bg-background/30" />
          ))
        ) : error ? (
          <div className="rounded-2xl border border-rose-200/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : !hasEvents ? (
          <div className="rounded-2xl border border-border/60 bg-background/30 px-4 py-5 text-sm text-muted-foreground">
            No live plans yet. Post an event to see it tracked here.
          </div>
        ) : (
          events.map((event) => {
            const hasPending = event.pendingRequests > 0;
            const hasAccepted = event.acceptedRequests > 0;

            return (
              <article
                key={event.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/30 px-4 py-4 text-sm text-foreground sm:flex-row sm:items-center"
              >
                <div
                  className={classNames(
                    'flex h-12 w-12 items-center justify-center rounded-2xl border text-primary',
                    hasPending
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  )}
                >
                  {hasPending ? <Clapperboard className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{event.title}</span>
                    <StatusBadge tone={hasPending ? 'primary' : 'success'}>
                      {hasPending
                        ? `${event.pendingRequests} pending`
                        : hasAccepted
                          ? 'All confirmed'
                          : 'Active'}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{event.locationName}</span>
                    <span className="h-1 w-1 rounded-full bg-border/60" aria-hidden="true" />
                    <span>{formatEventDatetime(event.datetime)}</span>
                    {hasAccepted ? (
                      <StatusBadge tone="neutral">{event.acceptedRequests} confirmed</StatusBadge>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

type StatusBadgeProps = {
  tone: 'primary' | 'success' | 'neutral';
  children: ReactNode;
};

function StatusBadge({ tone, children }: StatusBadgeProps) {
  const toneClasses: Record<StatusBadgeProps['tone'], string> = {
    primary: 'border-primary/40 bg-primary/10 text-primary',
    success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-50',
    neutral: 'border-border/60 bg-background/50 text-foreground',
  };

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

type SettingsRowConfig = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
};

function SettingsRow({ icon: Icon, label, onClick, variant = 'default' }: SettingsRowConfig) {
  const isDestructive = variant === 'destructive';

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'flex w-full items-center gap-3 border-b border-border/50 px-5 py-4 text-left last:border-b-0 transition',
        isDestructive ? 'text-rose-200 hover:bg-rose-500/5' : 'text-foreground hover:bg-background/40'
      )}
    >
      <span className={classNames('text-muted-foreground', isDestructive && 'text-rose-200/70')}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {!isDestructive ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
    </button>
  );
}

function ProfileMobileHero() {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 px-5 py-4 text-foreground shadow-xl shadow-black/20 md:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tonight</p>
      <h1 className="mt-1 text-2xl font-serif font-semibold leading-tight">Profile</h1>
      <p className="text-xs text-muted-foreground">Keep your Tonight identity up to date.</p>
    </div>
  );
}

function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className="h-32 animate-pulse rounded-3xl border border-border/40 bg-background/30" />
      ))}
    </div>
  );
}
