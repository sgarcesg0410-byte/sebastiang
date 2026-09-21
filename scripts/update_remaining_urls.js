import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ivlwxzhuwoqcxiftlyhr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g8UBqwb_NOl4wNLrFF9mKg_fLrLcUzr';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const remainingIds = [
  'cat-1789878355199',
  'cat-1789902452640',
  'cat-1789916145830'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function updateWithRetry(id) {
  const newUrl = `/catalog/${id}.jpg`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .update({ url: newUrl })
        .eq('id', id)
        .select();
      if (!error && data && data.length > 0) {
        console.log(`✓ Updated ${id} to ${newUrl}`);
        return true;
      }
      if (error) console.warn(`Attempt ${attempt} error for ${id}:`, error.message);
    } catch (e) {
      console.warn(`Attempt ${attempt} exception for ${id}:`, e.message);
    }
    await sleep(1000);
  }
  return false;
}

async function main() {
  for (const id of remainingIds) {
    await updateWithRetry(id);
    await sleep(500);
  }

  const { data: all } = await supabase.from('catalog').select('id,title,url');
  if (all) {
    const jsonStr = JSON.stringify(all);
    console.log(`Total catalog items in Supabase: ${all.length}`);
    console.log(`NEW TOTAL CATALOG PAYLOAD SIZE: ${(jsonStr.length / 1024).toFixed(2)} KB!`);
  }
}

main().catch(console.error);
