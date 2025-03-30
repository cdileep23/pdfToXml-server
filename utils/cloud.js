import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import  { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import dotenv from "dotenv"
dotenv.config({})

const s3Client = new S3Client({
  region: process.env.AWS_REGION, // e.g., 'us-east-1'
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const getObjectSignUrl=(key)=>{
    const command=new GetObjectCommand({
        Bucket:process.env.S3_BUCKET_NAME,key
    })
    const url=getSignedUrl(s3Client,command)
    return url
}

(async()=>{
    const url=await getObjectSignUrl('aaaaadjjc')
  console.log(url)
})()