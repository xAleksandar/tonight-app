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
    return status.type === 'success' ? 'text-emerald-600' : 'text-rose-600';
  }, [status]);

  return (
    <>
      <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900">
        <div className="mx-auto max-w-3xl space-y-8 rounded-2xl bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase text-violet-600">Account</p>
          <h1 className="text-3xl font-semibold">Profile</h1>
          <p className="text-sm text-zinc-500">Update how you appear across Tonight.</p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading profile…</p>
        ) : !profile ? (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-rose-700">
            We couldn’t load your profile. Try signing in again.
          </div>
        ) : (
          <form className="space-y-8" onSubmit={onSubmit}>
            <section className="flex flex-col gap-6 rounded-xl border border-zinc-100 p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <UserAvatar
                  displayName={profile.displayName}
                  email={profile.email}
                  photoUrl={currentPhotoPreview}
                  size="xl"
                />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{profile.email}</p>
                  <p className="text-zinc-500">Joined {formatDate(profile.createdAt)}</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                    placeholder="Add a friendly name"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                  <p className="text-xs text-zinc-500">Between 2 and 64 characters.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Photo
                  </label>
                  <div className="flex flex-col gap-3">
                    <input
                      type="url"
                      value={photoInput}
                      onChange={(event) => setPhotoInput(event.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                    <div className="flex flex-wrap gap-2 text-sm">
                      <button
                        type="button"
                        className="rounded-full border border-zinc-200 px-4 py-1 font-medium text-zinc-700 transition hover:border-violet-500 hover:text-violet-600"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload photo
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="rounded-full border border-transparent px-4 py-1 font-medium text-zinc-500 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={resetPhoto}
                        className="rounded-full border border-transparent px-4 py-1 font-medium text-zinc-500 transition hover:border-zinc-200 hover:bg-zinc-50"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">
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
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-zinc-100 p-6 shadow-sm">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-900">Safety</p>
                <p className="text-xs text-zinc-500">
                  Block or report someone if they make you uncomfortable. Safety notes stay private with the
                  Tonight team.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <BlockUserButton
                  targetUserId={profile.id}
                  targetDisplayName={profile.displayName ?? profile.email}
                  className="items-start"
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
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Flag className="h-4 w-4" />
                  Report user
                </button>
              </div>

              <p className={`text-xs ${reportNotice ? 'text-emerald-600' : 'text-zinc-500'}`}>
                {reportNotice
                  ? reportNotice
                  : viewingOwnProfile
                    ? 'Viewing your own profile. Visit another person’s profile to manage safety settings.'
                    : 'Reports alert Tonight’s safety team discreetly. Share details if something feels off.'}
              </p>
            </section>

            {status ? <p className={`text-sm font-medium ${statusStyles}`}>{status.message}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!hasChanges || saving}
                className="rounded-full bg-violet-600 px-6 py-2 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                disabled={!hasChanges || saving}
                className="rounded-full border border-zinc-200 px-6 py-2 font-semibold text-zinc-700 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
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
