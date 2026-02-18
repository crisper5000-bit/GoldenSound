import bcrypt from "bcryptjs";
import { PrismaClient, TrackStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin", 10);
  const sellerPassword = await bcrypt.hash("seller123", 10);
  const userPassword = await bcrypt.hash("user123", 10);

  const [admin, seller] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin" },
      update: {},
      create: {
        email: "admin",
        username: "System Admin",
        passwordHash: adminPassword,
        role: UserRole.ADMIN
      }
    }),
    prisma.user.upsert({
      where: { email: "seller@goldensound.dev" },
      update: {},
      create: {
        email: "seller@goldensound.dev",
        username: "Demo Seller",
        passwordHash: sellerPassword,
        role: UserRole.SELLER
      }
    })
  ]);

  await prisma.user.upsert({
    where: { email: "user@goldensound.dev" },
    update: {},
    create: {
      email: "user@goldensound.dev",
      username: "Demo User",
      passwordHash: userPassword,
      role: UserRole.USER
    }
  });

  const genreNames = ["Електронная", "Рок", "Хип-хоп", "Рэп", "Поп"];
  const genres = await Promise.all(
    genreNames.map((name) =>
      prisma.genre.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );

  const trackData = [
    {
      title: "Город под подошвой",
      description: "Жизнеутверждающий трек папочки окси",
      authorName: "Demo Seller",
      price: "3.99",
      mediaUrl: "/media/demo/окси.mp3",
      coverUrl: "/media/demo/город.jpg",
      genreId: genres[3].id
    },
    {
      title: "Баобаб",
      description: "Лучший трек ивана золкина",
      authorName: "Demo Seller",
      price: "4.49",
      mediaUrl: "/media/demo/guitar-horizon.mp3",
      coverUrl: "/media/demo/баобаб.jpg",
      genreId: genres[4].id
    },
    {
      title: "Я пират",
      description: "Классика от Александра Пистолетова",
      authorName: "Demo Seller",
      price: "2.99",
      mediaUrl: "/media/demo/midnight-coffee.mp3",
      coverUrl: "/media/demo/Александр.jpg",
      genreId: genres[1].id
    }
  ];

  for (const track of trackData) {
    const existing = await prisma.track.findFirst({
      where: {
        sellerId: seller.id,
        title: track.title
      }
    });

    if (!existing) {
      await prisma.track.create({
        data: {
          ...track,
          status: TrackStatus.APPROVED,
          sellerId: seller.id,
          publishedAt: new Date()
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
