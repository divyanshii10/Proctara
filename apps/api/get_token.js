const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.interviewSession.findFirst({
    where: {
      status: { in: ['pending', 'in_progress'] }
    },
    include: { candidate: true }
  });
  if (session) {
    console.log("Token:", session.inviteToken);
    console.log("Candidate Email:", session.candidate.email);
  } else {
    console.log("No active sessions found.");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
