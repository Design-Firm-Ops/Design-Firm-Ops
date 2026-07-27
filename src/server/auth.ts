import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/prisma';
import { loginDenialFor } from '@/lib/firmAccess';

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          // The firm's status comes back with the user rather than in a second
          // round trip — sign-in is on the critical path for every session.
          include: { firm: { select: { status: true } } },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Only past this point may we say anything specific. Everything above
        // returns a bare null so "no such user" and "wrong password" stay
        // indistinguishable; a firm-status message before the password check
        // would confirm to anyone guessing an address that the account exists
        // and which firm it belongs to.
        //
        // Thrown rather than returned because that's the only way NextAuth
        // carries a reason back to the form: a null becomes the generic
        // CredentialsSignin, while a thrown message reaches
        // `signIn(…, { redirect: false })` as `result.error`. The login page
        // turns the code into a sentence via `signInErrorMessage`.
        const denial = loginDenialFor(user.firm?.status);
        if (denial) throw new Error(denial);

        return { id: user.id, email: user.email, name: user.name, role: user.role, firmId: user.firmId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        // The tenant travels on the token so every request knows it without a
        // database round trip. Null for a SUPER_ADMIN.
        token.firmId = user.firmId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.firmId = token.firmId ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
