import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

async function createReceiptsBucket() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError);
    return;
  }

  const bucketExists = buckets?.some(b => b.id === 'receipts');

  if (bucketExists) {
    console.log('✅ Receipts bucket already exists');
    return;
  }

  // Create bucket
  const { data, error } = await supabase.storage.createBucket('receipts', {
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  });

  if (error) {
    console.error('❌ Error creating bucket:', error);
  } else {
    console.log('✅ Successfully created receipts bucket:', data);
  }
}

createReceiptsBucket();
