import { json } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { env } from '$env/dynamic/private';

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  }
});

// Log configuration at startup
console.log('R2 Configuration:', {
  endpoint: env.R2_ENDPOINT || 'NOT SET',
  bucket: env.R2_BUCKET_NAME || 'NOT SET',
  publicUrl: env.R2_PUBLIC_URL || 'NOT SET',
  hasAccessKey: !!env.R2_ACCESS_KEY_ID,
  hasSecretKey: !!env.R2_SECRET_ACCESS_KEY
});

export async function POST({ request, locals }) {
  console.log('Image upload request received');
  
  // Check if user is authenticated
  if (!locals.session?.user) {
    console.log('Unauthorized upload attempt');
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('User authenticated:', locals.session.user.username);

  try {
    // Get the form data with the image
    const formData = await request.formData();
    const file = formData.get('image');
    
    console.log('Form data received:', {
      hasFile: !!file,
      isFileInstance: file instanceof File,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size
    });
    
    if (!file || !(file instanceof File)) {
      console.log('No valid image file provided');
      return json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type);
      return json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' }, { status: 400 });
    }

    // Check if environment variables are set
    if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
      console.error('Missing R2 environment variables');
      return json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Generate a unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    console.log('Generated unique filename:', uniqueFilename);
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File converted to buffer, size:', buffer.length);

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: uniqueFilename,
      Body: buffer,
      ContentType: file.type
    });

    console.log('Sending upload command to R2');
    try {
      const uploadResult = await s3Client.send(command);
      console.log('R2 upload successful:', uploadResult);
    } catch (uploadError) {
      console.error('R2 upload failed:', uploadError);
      return json({ error: `R2 upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Return the URL to the uploaded image
    const imageUrl = `${env.R2_PUBLIC_URL}/${uniqueFilename}`;
    console.log('Image URL generated:', imageUrl);
    
    const response = { 
      success: true, 
      imageUrl,
      filename: uniqueFilename
    };
    console.log('Sending successful response:', response);
    
    return json(response);
  } catch (error) {
    console.error('Error uploading image:', error);
    return json({ error: error.message }, { status: 500 });
  }
} 