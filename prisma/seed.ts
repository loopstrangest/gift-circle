import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  await prisma.roomMembership.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  const host = await prisma.user.create({
    data: {
      displayName: "Seed Host",
    },
  });

  const guest = await prisma.user.create({
    data: {
      displayName: "Seed Guest",
    },
  });

  const room = await prisma.room.create({
    data: {
      code: "ABC123",
      hostId: host.id,
    },
  });

  await prisma.roomMembership.createMany({
    data: [
      {
        roomId: room.id,
        userId: host.id,
        role: "HOST",
        nickname: "Host",
      },
      {
        roomId: room.id,
        userId: guest.id,
        role: "PARTICIPANT",
        nickname: "Guest",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
