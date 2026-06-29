const prisma = require('../lib/prisma');

async function main() {
  console.log('Seeding database...');

  const products = [
    { name: 'Nusa Pro 7 Hari', description: 'Akses premium selama 7 hari.', price: 25000, durationDays: 7 },
    { name: 'Nusa Pro 30 Hari', description: 'Akses premium selama 30 hari.', price: 75000, durationDays: 30 },
    { name: 'Nusa Pro 90 Hari', description: 'Akses premium selama 90 hari.', price: 199000, durationDays: 90 },
    { name: 'Nusa Pro 365 Hari', description: 'Akses premium selama 1 tahun.', price: 599000, durationDays: 365 },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log('Database seeded!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
