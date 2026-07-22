import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../config/db";
import Category from "../models/Category";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const occasions: Record<string, string[]> = {
  Birthdays: ["Kids Birthday", "Teen Birthday", "Adult Birthday", "Milestone Birthdays", "Surprise Birthday", "Birthday Cakes", "Birthday Decorations", "Birthday Flowers", "Birthday Cards", "Birthday Hampers"],
  Weddings: ["Wedding Gifts", "Bridal Shower", "Bachelor Party", "Bachelorette Party", "Engagement", "Traditional Wedding", "White Wedding", "Wedding Decor", "Bridal Accessories", "Wedding Favours"],
  Anniversaries: ["Dating Anniversary", "Wedding Anniversary", "Work Anniversary", "Company Anniversary", "Silver Jubilee", "Golden Jubilee", "Anniversary Flowers"],
  "Valentine's Day": ["Gifts for Him", "Gifts for Her", "Flowers", "Chocolates", "Romantic Dinner", "Personalized Gifts", "Jewelry", "Love Letters", "Luxury Gifts"],
  "Mother's Day": ["Flowers", "Jewelry", "Spa Gifts", "Personalized Gifts", "Home Decor", "Gift Hampers"],
  "Father's Day": ["Watches", "Wallets", "Gadgets", "Fashion", "BBQ Gifts", "Personalized Gifts"],
  "Baby Celebrations": ["Baby Shower", "Naming Ceremony", "Christening", "Dedication", "Gender Reveal", "Newborn Gifts", "Baby Clothing", "Baby Toys"],
  Graduation: ["Graduation Gifts", "Flowers", "Money Bouquet", "Personalized Frames", "Gift Boxes"],
  Housewarming: ["Kitchen Gifts", "Home Decor", "Appliances", "Furniture", "Plants", "Wall Art"],
  Christmas: ["Christmas Gifts", "Secret Santa", "Christmas Hampers", "Christmas Trees", "Decorations", "Gift Boxes", "Stocking Fillers"],
  "New Year": ["Gift Hampers", "Champagne", "Party Supplies", "Fireworks", "New Year Cards"],
  Easter: ["Easter Eggs", "Chocolate Gifts", "Family Gifts", "Church Gifts", "Decorations"],
  Eid: ["Eid al-Fitr", "Eid al-Adha", "Food Hampers", "Prayer Gifts", "Clothing", "Perfumes"],
  Ramadan: ["Iftar Hampers", "Dates", "Prayer Mats", "Islamic Gifts", "Lanterns"],
  Thanksgiving: ["Family Dinner", "Food Hampers", "Wine", "Table Decor"],
  Halloween: ["Costumes", "Decorations", "Candy", "Party Supplies"],
  "Women's Day": ["Appreciation Gifts", "Flowers", "Office Gifts"],
  "Men's Day": ["Fashion", "Watches", "Grooming Kits"],
  "Children's Day": ["Toys", "Educational Gifts", "Clothing", "Books"],
  "Teacher Appreciation": ["Gift Cards", "Personalized Gifts", "Books", "Flowers"],
  Appreciation: ["Thank You Gifts", "Employee Recognition", "Mentor Appreciation", "Client Appreciation"],
  Congratulations: ["New Job", "Promotion", "New Business", "New Achievement", "Exam Success"],
  "Get Well Soon": ["Flowers", "Fruit Basket", "Care Package", "Wellness Gifts"],
  "Sympathy & Condolence": ["Sympathy Flowers", "Memorial Gifts", "Funeral Wreaths", "Condolence Cards"],
  Retirement: ["Retirement Gifts", "Plaques", "Travel Gifts", "Hobby Gifts"],
  "Corporate Events": ["Corporate Gifts", "Employee Welcome Kits", "Conference Gifts", "Client Gifts", "Executive Gifts"],
  "Religious Celebrations": ["Christmas", "Easter", "Eid", "Ramadan", "Diwali", "Hanukkah", "Baptism", "Confirmation", "First Communion"],
  "Romantic Occasions": ["First Date", "Proposal", "Engagement", "Date Night", "Honeymoon", "Valentine's"],
  Seasonal: ["Spring", "Summer", "Autumn", "Winter", "Back to School"],
  "Personal Milestones": ["New Home", "New Car", "New Baby", "New Pet", "First Salary", "Retirement", "Promotion", "Graduation"],
};

const giftTypes = [
  "Flowers", "Cakes", "Chocolates", "Gift Hampers", "Jewelry", "Watches", "Perfumes", "Clothing", "Shoes", "Bags",
  "Electronics", "Gadgets", "Home Appliances", "Home Decor", "Furniture", "Personalized Gifts", "Custom Engraving",
  "Gift Cards", "Experiences", "Books", "Toys", "Stationery", "Art", "Plants", "Food & Drinks", "Luxury Gifts", "DIY Gifts",
];

async function run() {
  await connectDB();
  console.log("Seeding categories...");

  let order = 0;
  for (const [parentName, subs] of Object.entries(occasions)) {
    const parent = await Category.findOneAndUpdate(
      { slug: slugify(parentName) },
      { name: parentName, slug: slugify(parentName), parent: null, order: order++, isGiftType: false },
      { upsert: true, new: true }
    );

    let subOrder = 0;
    for (const subName of subs) {
      const slug = slugify(`${parentName}-${subName}`);
      await Category.findOneAndUpdate(
        { slug },
        { name: subName, slug, parent: parent._id, order: subOrder++, isGiftType: false },
        { upsert: true, new: true }
      );
    }
  }

  let gtOrder = 0;
  for (const name of giftTypes) {
    await Category.findOneAndUpdate(
      { slug: slugify(name) },
      { name, slug: slugify(name), parent: null, order: gtOrder++, isGiftType: true },
      { upsert: true, new: true }
    );
  }

  console.log("Done seeding categories.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
