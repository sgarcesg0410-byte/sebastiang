const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('No MONGODB_URI found');
  process.exit(1);
}

const client = new MongoClient(uri);

function getPhotoTimestamp(item) {
  if (!item) return 0;
  if (item.id === 'cat-verano-salsero') return 1789878000000;
  const match = String(item.id || '').match(/^cat-(\d{11,14})/);
  if (match) {
    const ts = Number(match[1]);
    if (!isNaN(ts) && ts > 1000000000000) return ts;
  }
  if (item.createdAt) {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.updatedAt) {
    const t = new Date(item.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

async function run() {
  await client.connect();
  const db = client.db('sebastiang');
  const col = db.collection('catalog');
  const docs = await col.find({}).toArray();
  const photos = docs.filter(d => 
    d.id && 
    !d.id.startsWith('book-') && 
    !d.id.startsWith('pay-') && 
    !d.id.startsWith('sess-') && 
    !d.id.startsWith('rev-') && 
    !d.id.startsWith('vip-') && 
    !d.id.startsWith('system_') && 
    d.category !== 'vip_client'
  );

  let updatedCount = 0;
  for (const p of photos) {
    const ts = getPhotoTimestamp(p);
    if (ts > 0) {
      const realCreatedAt = new Date(ts).toISOString();
      await col.updateOne({ id: p.id }, { $set: { createdAt: realCreatedAt } });
      updatedCount++;
    }
  }
  console.log('Updated createdAt on ' + updatedCount + ' photos in MongoDB.');

  const allPhotos = await col.find({
    category: { $nin: ['session_data', 'vip_client', 'payment_data'] },
    id: { $not: /^book-|^pay-|^sess-|^rev-|^vip-|^system_/ }
  }).sort({ createdAt: -1 }).toArray();

  console.log('\nTop 5 in Mongo after update ({ createdAt: -1 }):');
  allPhotos.slice(0, 5).forEach((p, i) => console.log(i + 1, p.id, '|', p.createdAt, '|', p.title));

  console.log('\nLast 3 in Mongo after update:');
  allPhotos.slice(-3).forEach((p, i) => console.log(allPhotos.length - 3 + i + 1, p.id, '|', p.createdAt, '|', p.title));

  await client.close();
}

run().catch(err => {
  console.error('Error running fix-catalog-order:', err);
  process.exit(1);
});
