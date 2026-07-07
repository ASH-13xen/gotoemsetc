require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const env = require('../src/config/env');
const QuotationTemplate = require('../src/models/QuotationTemplate');
const { getPageCount } = require('../src/services/pdfStamp.service');

const durationOptions = [
  { key: '1_month', label: '1 Month' },
  { key: '3_months', label: '3 Months' },
  { key: '6_months', label: '6 Months' },
  { key: '12_months', label: '12 Months' },
];

const quantityOptions = [
  { key: '1_podcast', label: '1 Podcast' },
  { key: '2_podcasts', label: '2 Podcasts' },
  { key: '4_podcasts', label: '4 Podcasts' },
  { key: '8_podcasts', label: '8 Podcasts' },
];

// Each of the 8 is a genuinely distinct layout — no two share field
// positions, hence why every one needs its own calibration pass through the
// Template Mapper UI before it can be used to generate a real quotation.
const templates = [
  {
    key: 'go-to-diamond', title: 'GO-TO x Diamond', companyLabel: 'GO-TO Friend Pvt. Ltd.',
    pdfFilename: 'GO-TO x DIAMOND.pdf', planType: 'duration', planOptions: durationOptions,
    hasBrandName: false, hasDateField: true,
  },
  {
    key: 'go-to-gold', title: 'GO-TO x Gold', companyLabel: 'GO-TO Friend Pvt. Ltd.',
    pdfFilename: 'GO-TO x GOLD.pdf', planType: 'duration', planOptions: durationOptions,
    hasBrandName: true, hasDateField: true,
  },
  {
    key: 'go-to-platinum', title: 'GO-TO x Platinum', companyLabel: 'GO-TO Friend Pvt. Ltd.',
    pdfFilename: 'GO-TO x PLATINUM.pdf', planType: 'duration', planOptions: durationOptions,
    hasBrandName: true, hasDateField: true,
  },
  {
    key: 'go-to-pm-premium', title: 'GO-TO x Podcast Marketing (Premium)', companyLabel: 'GO-TO Friend Pvt. Ltd.',
    pdfFilename: 'GO-TO x PM PREMIUM.pdf', planType: 'quantity', planOptions: quantityOptions,
    hasBrandName: true, hasDateField: false,
  },
  {
    key: 'go-to-pm-pro', title: 'GO-TO x Podcast Marketing (Pro)', companyLabel: 'GO-TO Friend Pvt. Ltd.',
    pdfFilename: 'GO-TO x PM PRO.pdf', planType: 'quantity', planOptions: quantityOptions,
    hasBrandName: true, hasDateField: false,
  },
  {
    key: 'go-to-pm-standard', title: 'GO-TO x Podcast Marketing (Standard)', companyLabel: 'GO-TO Friend Pvt. Ltd.',
    pdfFilename: 'GO-TO x PM STANDARD.pdf', planType: 'quantity', planOptions: quantityOptions,
    hasBrandName: true, hasDateField: false,
  },
  {
    key: 'rp-growth', title: 'Raipur Podcast — Growth Package', companyLabel: 'Raipur Podcast',
    pdfFilename: 'RP GROWTH PACKAGE.pdf', planType: 'fixed', planOptions: [],
    hasBrandName: true, combinedNameBrand: true, hasDateField: false, fixedAmount: 20000,
  },
  {
    key: 'rp-pro', title: 'Raipur Podcast — Pro Package', companyLabel: 'Raipur Podcast',
    pdfFilename: 'RP PRO PACKAGE.pdf', planType: 'fixed', planOptions: [],
    hasBrandName: true, combinedNameBrand: true, hasDateField: false, fixedAmount: 25000,
  },
];

async function main() {
  await mongoose.connect(env.mongodbUri);

  for (const template of templates) {
    const pageCount = await getPageCount(template.pdfFilename);
    await QuotationTemplate.findOneAndUpdate(
      { key: template.key },
      { $set: { ...template, pageCount }, $setOnInsert: { fields: {}, isConfigured: false } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    console.log(`Seeded quotation template: ${template.key} (${pageCount} pages)`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
