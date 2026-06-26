import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protects all routes under /dashboard and /campaigns
  matcher: ["/dashboard/:path*", "/campaigns/:path*"],
};
