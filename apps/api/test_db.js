const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { template: true }
  });
  console.log(JSON.stringify(c, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
