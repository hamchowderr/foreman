import { currentUser } from "@clerk/nextjs/server";

export type UserType = "guest" | "regular";

export type SessionUser = {
  id: string;
  email: string;
  image?: string | null;
  type?: UserType | undefined;
};

export type Session = {
  user: SessionUser;
};

/**
 * Server-side auth helper that wraps Clerk's currentUser().
 * Returns a session object compatible with the old next-auth shape,
 * or null if not authenticated.
 */
export async function auth(): Promise<Session | null> {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? "",
      image: user.imageUrl,
      type: "regular" as UserType,
    },
  };
}
