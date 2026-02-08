export type PublicUserFields = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  createdAt: Date;
};

export const serializeUser = (user: PublicUserFields) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  photoUrl: user.photoUrl,
  createdAt: user.createdAt,
});
