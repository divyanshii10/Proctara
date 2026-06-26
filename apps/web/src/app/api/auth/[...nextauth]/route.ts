import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" }
          });
          
          const data = await res.json();
          if (data.success && data.data) {
            return {
              id: data.data.user.id,
              email: data.data.user.email,
              name: data.data.user.name,
              jwtToken: data.data.token,
              companyId: data.data.company.id,
            };
          }
          return null;
        } catch (e) {
          console.error("Auth error:", e);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.jwtToken = (user as any).jwtToken;
        token.companyId = (user as any).companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as any).jwtToken = token.jwtToken;
        (session as any).companyId = token.companyId;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET || "proctara-secret-key-12345"
});

export { handler as GET, handler as POST };
