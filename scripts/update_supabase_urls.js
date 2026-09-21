import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ivlwxzhuwoqcxiftlyhr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g8UBqwb_NOl4wNLrFF9mKg_fLrLcUzr';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const photoIds = [
  'cat-1789878355199',
  'cat-1789902452640',
  'cat-1789916017066',
  'cat-1789916075257',
  'cat-1789916145830',
  'cat-1789916197806',
  'cat-1789916408679',
  'cat-1789916617329'
];

async function main() {
  for (const id of photoIds) {
    const newUrl = `/catalog/${id}.jpg`;
    const { data, error } = await supabase
      .from('catalog')
      .update({ url: newUrl })
      .eq('id', id)
      .select();
    if (error) {
      console.error(`Error updating ${id}:`, error.message);
    } else {
      console.log(`✓ Updated ${id} to ${newUrl}`);
    }
  }

  // Verificar tamaño total del catálogo ahora
  const { data: all, error: e2 } = await supabase
    .from('catalog')
    .select('id,title,url');
  if (all) {
    const jsonStr = JSON.stringify(all);
    console.log(`Total catalog items: ${all.length}`);
    console.log(`New catalog total size in KB: ${(jsonStr.length / 1024).toFixed(2)} KB`);
  }
}

main().catch(console.error);
