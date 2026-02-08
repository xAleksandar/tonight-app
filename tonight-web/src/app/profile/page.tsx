'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag } from 'lucide-react';

import BlockUserButton from '@/components/BlockUserButton';
import ReportModal from '@/components/ReportModal';
import UserAvatar from '@/components/UserAvatar';
import { AuthStatusMessage } from '@/components/auth/AuthStatusMessage';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <>
      <div className="min-h-dvh bg-gradient-to-b from-[#101227] via-[#0f1324] to-[#050814] px-4 py-6 text-white sm:px-6 md:py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="space-y-2 text-white/90">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Account</p>
            <h1 className="text-3xl font-semibold leading-tight">Profile</h1>
            <p className="text-sm text-white/70">Update how you appear across Tonight and keep your safety settings close.</p>
          </div>

          {loading ? (
            <ProfilePageSkeleton />
          ) : !profile ? (
            <div className="rounded-3xl border border-rose-200/30 bg-rose-500/10 p-6 text-sm text-rose-50 shadow-xl shadow-rose-900/20">
              We couldn’t load your profile. Try signing in again.
            </div>
          ) : (
            <form className="space-y-6" onSubmit={onSubmit}>
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <UserAvatar
                    displayName={profile.displayName}
                    email={profile.email}
                    photoUrl={currentPhotoPreview}
                    size="xl"
                  />
                  <div className="flex-1 space-y-1 text-sm">
                    <p className="text-base font-semibold text-white">{profile.email}</p>
                    <p className="text-white/70">Joined {formatDate(profile.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 text-xs text-white/60 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/50">Status</p>
                    <p className="text-sm font-semibold text-white">{viewingOwnProfile ? 'Your profile' : 'Guest view'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/50">Display name</p>
                    <p className="text-sm font-semibold text-white">
                      {profile.displayName ? profile.displayName : 'Not set'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/50">Photo</p>
                    <p className="text-sm font-semibold text-white">{profile.photoUrl ? 'Custom' : 'Default'}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Display name</label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                    placeholder="Add a friendly name"
                    className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                  />
                  <p className="text-xs text-white/60">Between 2 and 64 characters.</p>
                </div>

                <div className="mt-6 space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Photo</label>
                  <input
                    type="url"
                    value={photoInput}
                    onChange={(event) => setPhotoInput(event.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                  />
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-4 py-1.5 font-semibold text-white transition hover:border-emerald-300 hover:text-emerald-200"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload photo
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="rounded-full border border-transparent px-4 py-1.5 font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/5"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={resetPhoto}
                      className="rounded-full border border-transparent px-4 py-1.5 font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/5"
                    >
                      Reset
                    </button>
                  </div>
                  <p className="text-xs text-white/60">
                    Paste a public URL or upload a new image (stored as a data URL for preview).
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
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">Safety</p>
                  <p className="text-xs text-white/70">
                    Block or report someone if they make you uncomfortable. Safety notes stay private with the Tonight team.
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <BlockUserButton
                    targetUserId={profile.id}
                    targetDisplayName={profile.displayName ?? profile.email}
                    className="items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
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
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:border-rose-200/60 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Flag className="h-4 w-4" />
                    Report user
                  </button>
                </div>

                <p className={`mt-3 text-xs ${reportNotice ? 'text-emerald-300' : 'text-white/60'}`}>
                  {reportNotice
                    ? reportNotice
                    : viewingOwnProfile
                      ? 'Viewing your own profile. Visit another person’s profile to manage safety settings.'
                      : 'Reports alert Tonight’s safety team discreetly. Share details if something feels off.'}
                </p>
              </section>

              {status ? <p className={`text-sm font-semibold ${statusStyles}`}>{status.message}</p> : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!hasChanges || saving}
                  className="rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  disabled={!hasChanges || saving}
                  className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
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
          )}
        </div>
      </div>

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
    </>
  );
}

function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}
