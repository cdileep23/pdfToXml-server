import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import pkg from 'pdfjs-dist';
import { conversionModel } from '../models/conversion.model.js';
import UserModel from '../models/user.model.js';
const { getDocument } = pkg;

// Load environment variables
dotenv.config();

const parsePdfFromUrl = async (url) => {
    try {
        // Fetch the PDF
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);

        const pdfBytes = await response.arrayBuffer();

        // Load the PDF document
        const pdf = await getDocument({
            data: pdfBytes,
            // password: 'your-password', // (Uncomment if PDF is password-protected)
        }).promise;

        let fullText = '';

        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `Page ${i}: ${pageText}\n\n`;
        }
        const noOfPages = pdf.numPages;

        console.log(fullText); // Log the extracted text
        return { fullText, noOfPages };
    } catch (error) {
        console.error('Error parsing PDF:', error.message);
        throw error;
    }
};

async function processTextWithOpenRouter(text, apiKey, promptType = "initial") {
    const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
    
    // Define different prompts based on processing stage
    let prompt;
    if (promptType === "initial") {
        prompt = `Convert this to clean, well-formatted XML:\n${text}`;
    } else if (promptType === "refine") {
        prompt = `remove content without any tag and give only xml code as response nothing else:\n\n${text}`;
    }
    
    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "http://localhost:5173/",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-r1:free",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.3, // Lower for more consistent XML output
            }),
        });

        // Handle response stream properly
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }

        // Extract and clean the XML content
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) throw new Error("No content in response");

        // Clean and validate the XML
        const cleanedXml = cleanXmlResponse(rawContent);
        
        // Optional: Validate XML structure
        try {
            validateXmlStructure(cleanedXml);
        } catch (err) {
            console.warn("XML validation warning:", err.message);
        }

        return {
            xml: cleanedXml,
            metadata: {
                model: data.model,
                usage: data.usage,
                finish_reason: data.choices?.[0]?.finish_reason
            }
        };

    } catch (error) {
        console.error("OpenRouter processing error:", error);
        throw new Error(`XML processing failed: ${error.message}`);
    }
}

// Helper function to clean XML output
function cleanXmlResponse(xmlString) {
    // Remove markdown code blocks if present
    let cleaned = xmlString.replace(/```xml/g, '').replace(/```/g, '').trim();
    
    // Fix common XML issues
    cleaned = cleaned
        // Fix unclosed tags
        .replace(/<([a-z_]+)([^>]*)>(?!.*<\/\1>)/g, '<$1$2></$1>')
        // Remove XML declaration if present (optional)
        .replace(/<\?xml[^>]+\?>/, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><');

    return cleaned;
}

// Helper function for basic XML validation
function validateXmlStructure(xmlString) {
    // Check for balanced tags
    const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9_-]*)([^>]*)>/g;
    const stack = [];
    let match;
    
    while ((match = tagRegex.exec(xmlString)) !== null) {
        const [fullMatch, isClosing, tagName] = match;
        if (!isClosing) {
            stack.push(tagName);
        } else {
            if (stack.length === 0 || stack.pop() !== tagName) {
                throw new Error(`Mismatched XML tags: ${tagName}`);
            }
        }
    }
    
    if (stack.length > 0) {
        throw new Error(`Unclosed XML tags: ${stack.join(', ')}`);
    }
}

// AWS S3 client setup
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1', // Fallback region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

export const createConversion = async (req, res) => {
    try {


        const userId=req.id;
        const userExists=await UserModel.findById(userId);
        if(!userExists){
            res.status(400).json({
                success:false,
                message:"User Not Found"
            })
        }

        if (!req.files?.pdfFile) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const pdfFile = req.files.pdfFile;

        // Validate PDF
        if (!pdfFile.mimetype.includes('pdf')) {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        // Sanitize filename
        const sanitizedName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');

        const fileName = `conversions/${uuidv4()}-${sanitizedName}`;
    
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            Body: pdfFile.data,
            ContentType: 'application/pdf',
            ACL: 'public-read'
        };

        console.log('Uploading to S3...');
        const uploadResponse = await s3Client.send(new PutObjectCommand(uploadParams));

        // Generate public URL
        const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        
        // Parse the PDF to extract text
        const { fullText, noOfPages } = await parsePdfFromUrl(publicUrl);
        console.log("Parsed Text");
        
        // Initial XML conversion
        const initialResult = await processTextWithOpenRouter(fullText, process.env.OPENROUTER_API_KEY, "initial");
        console.log("Initial XML conversion complete");
        
        // Secondary processing to refine and structure the XML
        const refinedResult = await processTextWithOpenRouter(initialResult.xml, process.env.OPENROUTER_API_KEY, "refine");
        console.log("XML refinement complete");
        console.log(refinedResult)
        // Save the conversion in the database
        const newConversion = await conversionModel.create({
            userId: req.id,
            pdfLink: publicUrl,
            xmlContent: refinedResult.xml, // Use the refined XML
            originalFilename: sanitizedName,
            pdfPages: noOfPages
        });

        return res.status(200).json({
            success: true,
            message: "Successfully generated",
            conversion: newConversion
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

export const getAllConversions=async(req,res)=>{
    try {
        const userId=req.id;
        const userExists=await UserModel.findById(userId);
        if(!userExists){
            res.status(400).json({
                success:false,
                message:"User Not Found"
            })
        }

        const conversions = await conversionModel.find({ userId });

        return res.status(200).json({
            message: conversions.length > 0 
                ? "Successfully fetched all conversions" 
                : "No conversions found for this user",
            conversions: conversions,
            success: true
        });
    } catch (error) {
        console.log(error)
        return res.status(400).json({
         message:error.message,
         success:false
        
        })
    }
}

export const getConversionById = async (req, res) => {
    try {
        const { conversionId } = req.params;
        const userId = req.id;

        // Check if conversionId is provided
        if (!conversionId) {
            return res.status(400).json({
                success: false,
                message: "Conversion ID is required",
            });
        }

        // Validate if userId exists
        const userExists = await UserModel.findById(userId);
        if (!userExists) {
            return res.status(404).json({  // 404 = Not Found
                success: false,
                message: "User not found",
            });
        }

        // Check if conversion exists
        const conversion = await conversionModel.findById(conversionId);
        if (!conversion) {
            return res.status(404).json({
                success: false,
                message: "Conversion not found",
            });
        }

        // Optional: Ensure the conversion belongs to the user
        if (conversion.userId.toString() !== userId.toString()) {
            return res.status(403).json({  // 403 = Forbidden
                success: false,
                message: "Unauthorized access to this conversion",
            });
        }

        return res.status(200).json({
            success: true,
            conversion,
            message: "Successfully fetched conversion",
        });

    } catch (error) {
        console.error("Error in getConversionById:", error);

        // Handle invalid ObjectId errors (e.g., malformed conversionId)
        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid Conversion ID format",
            });
        }

        // Generic error response (avoid exposing internal errors in production)
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching conversion",
        });
    }
};
export const removeConversionById = async (req, res) => {
    try {
        const { conversionId } = req.params;
        const userId = req.id;

        // 1. Validate inputs
        if (!conversionId) {
            return res.status(400).json({
                success: false,
                message: "Conversion ID is required",
            });
        }

        // 2. Verify user exists
        const userExists = await UserModel.findById(userId);
        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // 3. Find conversion and verify ownership
        const conversion = await conversionModel.findById(conversionId);
        
        if (!conversion) {
            return res.status(404).json({
                success: false,
                message: "Conversion not found",
            });
        }

        // 4. Ownership check (critical security)
        if (conversion.userId.toString() !== userId.toString()) {
            return res.status(403).json({ // 403 Forbidden
                success: false,
                message: "Unauthorized: You can only delete your own conversions",
            });
        }

        // 5. Proceed with deletion
        await conversionModel.findByIdAndDelete(conversionId);

        return res.status(200).json({
            success: true,
            message: "Conversion deleted successfully",
        });

    } catch (error) {
        console.error("Delete conversion error:", error);
        
        // Handle invalid ObjectId format
        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid Conversion ID format",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error while deleting conversion",
        });
    }
};