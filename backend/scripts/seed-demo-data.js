/**
 * BillFlow-Pro — Demo Data Seed Script
 *
 * DISCLAIMER: This script provisions a baseline environment (Business, User, Customers, Items)
 * exclusively for demonstration and evaluation purposes.
 *
 * Security: It requires a DEMO_PASSWORD environment variable and does NOT hardcode credentials.
 * Idempotency: Running this script multiple times will not create duplicates.
 *
 * Usage:
 *   DEMO_PASSWORD="your-secure-password" node scripts/seed-demo-data.js
 */

const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load env config
const env = require(path.join(__dirname, '..', 'src', 'config', 'env'));

if (env.customDnsServers) {
  require('dns').setServers(env.customDnsServers);
}

const Business = require(path.join(__dirname, '..', 'src', 'models', 'Business'));
const User = require(path.join(__dirname, '..', 'src', 'models', 'User'));
const Customer = require(path.join(__dirname, '..', 'src', 'models', 'Customer'));
const Item = require(path.join(__dirname, '..', 'src', 'models', 'Item'));

const SALT_ROUNDS = 10;
const DEMO_USER_EMAIL = 'demo@billflow.local';

async function runSeed({ preserveConnection = false } = {}) {
  const password = process.env.DEMO_PASSWORD || 'DemoPass123!';
  let didConnect = false;

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(env.mongoUri);
      didConnect = true;
      console.log(`✅ Connected to MongoDB: ${env.mongoUri}`);
    }

    // 1. Upsert Demo Business
    const businessState = 'Maharashtra';
    let business = await Business.findOneAndUpdate(
      { email: 'business@billflow.local' },
      {
        $setOnInsert: {
          name: 'Demo Innovations Pvt Ltd',
          address: '123 Tech Park, Andheri East',
          city: 'Mumbai',
          state: businessState,
          pinCode: '400069',
          gstin: '27AAAAA0000A1Z5',
          pan: 'AAAAA0000A',
          phone: '9876543210'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Business ensured: ${business.name} (State: ${business.state})`);

    // 2. Upsert Demo User
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    let user = await User.findOneAndUpdate(
      { email: DEMO_USER_EMAIL },
      {
        $set: { passwordHash },
        $setOnInsert: {
          businessId: business._id,
          name: 'Demo Administrator',
          role: 'Admin'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ User ensured: ${user.email}`);

    // 3. Upsert Customers
    // A. Intra-state Customer (Same state as business -> CGST/SGST applies)
    let customer1 = await Customer.findOneAndUpdate(
      { email: 'local@client.local', businessId: business._id },
      {
        $setOnInsert: {
          name: 'Local Retailers',
          customerType: 'Business',
          phone: '9998887776',
          billingAddress: '45 MG Road, Pune',
          city: 'Pune',
          state: 'Maharashtra', // Intra-state
          pinCode: '411001',
          gstin: '27BBBBB1111B1Z6'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Customer ensured: ${customer1.name} (${customer1.state})`);

    // B. Inter-state Customer (Different state -> IGST applies)
    let customer2 = await Customer.findOneAndUpdate(
      { email: 'inter@client.local', businessId: business._id },
      {
        $setOnInsert: {
          name: 'National Corp',
          customerType: 'Business',
          phone: '7776665554',
          billingAddress: '100 Ring Road, Bangalore',
          city: 'Bangalore',
          state: 'Karnataka', // Inter-state
          pinCode: '560001',
          gstin: '29CCCCC2222C1Z7'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Customer ensured: ${customer2.name} (${customer2.state})`);

    // 4. Upsert Items in Rupees
    // Use HSN codes from seed-tax-config.js (84713010: 18%, 04011000: 0%)
    let item1 = await Item.findOneAndUpdate(
      { sku: 'LAP-PRO-01', businessId: business._id },
      {
        $setOnInsert: {
          type: 'Product',
          name: 'Professional Laptop',
          description: '14-inch, 16GB RAM, 512GB SSD',
          unit: 'NOS',
          hsnSac: '84713010', // 18% Taxable
          unitPrice: '55000.00', // 55,000.00 in rupees
          costPrice: '40000.00', // 40,000.00 in rupees
          taxType: 'Exclusive',
          currentStock: 50,
          lowStockThreshold: 5,
          isActive: true
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Item ensured: ${item1.name}`);

    let item2 = await Item.findOneAndUpdate(
      { sku: 'IT-CONSULT-01', businessId: business._id },
      {
        $setOnInsert: {
          type: 'Service',
          name: 'IT Consulting (Hourly)',
          description: 'Infrastructure setup and maintenance',
          unit: 'HRS',
          hsnSac: '998313', // IT Consulting Services
          unitPrice: '2000.00', // 2,000.00 in rupees
          taxType: 'Exclusive',
          isActive: true
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Item ensured: ${item2.name}`);

    let item3 = await Item.findOneAndUpdate(
      { sku: 'MILK-F-01', businessId: business._id },
      {
        $setOnInsert: {
          type: 'Product',
          name: 'Fresh Milk',
          description: 'Organic unpasteurized milk',
          unit: 'LTR',
          hsnSac: '04011000', // 0% Nil Rated
          unitPrice: '60.00', // 60.00 in rupees
          costPrice: '45.00', // 45.00 in rupees
          taxType: 'Inclusive',
          currentStock: 100,
          lowStockThreshold: 10,
          isActive: true
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Item ensured: ${item3.name}`);

    console.log('\n🎉 Demo Data Seeding Complete.');
    console.log('----------------------------------------------------');
    console.log('Login Email:', DEMO_USER_EMAIL);
    console.log('Password   :', password === 'DemoPass123!' ? 'DemoPass123! (default)' : '***(from DEMO_PASSWORD env)***');
    console.log('----------------------------------------------------');

    return { business, user, customer1, customer2, items: [item1, item2, item3] };
  } catch (err) {
    console.error('❌ Error seeding demo data:', err);
    throw err;
  } finally {
    if (!preserveConnection && didConnect) {
      await mongoose.connection.close();
    }
  }
}

module.exports = { runSeed };

if (require.main === module) {
  runSeed().catch(() => {
    process.exit(1);
  });
}
