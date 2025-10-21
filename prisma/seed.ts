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

  const hostMembership = await prisma.roomMembership.findFirstOrThrow({
    where: { roomId: room.id, userId: host.id },
  });

  const guestMembership = await prisma.roomMembership.findFirstOrThrow({
    where: { roomId: room.id, userId: guest.id },
  });

  const offer = await prisma.offer.create({
    data: {
      roomId: room.id,
      authorMembershipId: hostMembership.id,
      title: "Handmade scarf",
      details: "Warm scarf in blue and gray wool",
    },
  });

  const desire = await prisma.desire.create({
    data: {
      roomId: room.id,
      authorMembershipId: guestMembership.id,
      title: "Need help moving",
      details: "Looking for assistance moving a sofa this weekend",
    },
  });

  await prisma.claim.createMany({
    data: [
      {
        roomId: room.id,
        claimerMembershipId: guestMembership.id,
        offerId: offer.id,
        status: "PENDING",
        note: "I could really use a warm scarf!",
      },
      {
        roomId: room.id,
        claimerMembershipId: hostMembership.id,
        desireId: desire.id,
        status: "ACCEPTED",
        note: "Happy to help move on Saturday",
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
