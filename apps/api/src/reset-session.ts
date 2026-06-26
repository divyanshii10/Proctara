import dotenv from 'dotenv';
dotenv.config({ override: true });
import prisma from './lib/prisma';

async function main() {
  const token = '1161faadcf6644a2a74b15f8e891bb044eab8e81eb4340578d1822d47718df25';
  console.log(`--- RESETTING SESSION FOR TOKEN: ${token} ---`);
  
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { inviteToken: token },
      include: { responses: true }
    });

    if (!session) {
      console.log('No session found for this token.');
      return;
    }

    console.log(`Current session status: ${session.status}`);
    console.log(`Current responses count: ${session.responses.length}`);

    // Update session status to pending and delete all responses to start clean
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        status: 'pending',
        completedAt: null,
        startedAt: null,
      }
    });

    await prisma.response.deleteMany({
      where: { sessionId: session.id }
    });

    console.log('Session successfully reset to pending and responses cleared!');
  } catch (e) {
    console.error('Error resetting session:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
