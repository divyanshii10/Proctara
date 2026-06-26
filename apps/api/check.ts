import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const prisma = new PrismaClient();
async function main() {
  const token = '1161faadcf6644a2a74b15f8e891bb044eab8e81eb4340578d1822d47718df25';
  const session = await prisma.interviewSession.findUnique({ where: { inviteToken: token } });
  console.log("Session:", session);
  if (!session) {
    console.log("ALL SESSIONS:");
    const all = await prisma.interviewSession.findMany({ select: { id: true, inviteToken: true, status: true, candidateId: true } });
    console.dir(all, { depth: null });
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
