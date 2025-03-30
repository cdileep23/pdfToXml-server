import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure S3 client with proper error handling
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1', // Fallback region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export const createConversion = async (req, res) => {
  try {
    // Debugging: Log incoming files
    console.log('Incoming files:', req.files);

    if (!req.files?.pdfFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const pdfFile = req.files.pdfFile;
    console.log('Processing file:', pdfFile.name, 'Size:', pdfFile.size);

    // Validate PDF
    if (!pdfFile.mimetype.includes('pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Sanitize filename
    const sanitizedName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const fileNameForDoc=sanitizedName;
    const fileName = `conversions/${uuidv4()}-${sanitizedName}`;
    console.log('Generated S3 key:', fileName);

  
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: pdfFile.data,
      ContentType: 'application/pdf',
      ACL: 'public-read'
    };

    console.log('Uploading to S3...');
    const uploadResponse = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('S3 upload successful:', uploadResponse);

    // Generate public URL
    const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    
    return res.status(200).json({
      success: true,
      publicUrl,
      fileName
    });

  } catch (error) {
    console.error('Full error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'File upload failed',
      details: {
        message: error.message,
        code: error.$metadata?.httpStatusCode,
        awsError: error.name
      }
    });
  }
};