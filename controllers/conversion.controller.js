import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import pkg from 'pdfjs-dist';
import { conversionModel } from '../models/conversion.model.js';
import UserModel from '../models/user.model.js';
const { getDocument } = pkg;

dotenv.config();

function cleanXmlString(xmlString) {
    if (!xmlString) return '';
    
    // Remove all text before <?xml
    const xmlStart = xmlString.indexOf('<?xml');
    if (xmlStart < 0) return xmlString;
    
    let cleaned = xmlString.slice(xmlStart);
    
    // Remove any trailing text after the root element closes
    const rootClose = cleaned.lastIndexOf('</');
    if (rootClose > 0) {
        const endTag = cleaned.slice(rootClose).match(/<\/[^>]+>/);
        if (endTag) {
            const fullClose = rootClose + endTag[0].length;
            cleaned = cleaned.substring(0, fullClose);
        }
    }
    
    return cleaned;
}

const parsePdfFromUrl = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);

        const pdfBytes = await response.arrayBuffer();
        const pdf = await getDocument({ data: pdfBytes }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `Page ${i}: ${pageText}\n\n`;
        }
        
        return { fullText, noOfPages: pdf.numPages };
    } catch (error) {
        console.error('Error parsing PDF:', error.message);
        throw error;
    }
};

async function processTextWithOpenRouter(text, apiKey, promptType = "initial") {
    const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
    let prompt = promptType === "initial" 
        ? `Convert this to clean, well-formatted XML for full content:\n${text}`
        : `Provide only the raw XML without any additional text:\n\n${text}`;

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
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API request failed');
        if (!data.choices?.[0]?.message?.content) throw new Error("No content in response");
        
        return {
            xml: cleanXmlString(data.choices[0].message.content),
            metadata: {
                model: data.model,
                usage: data.usage,
                finish_reason: data.choices[0].finish_reason
            }
        };
    } catch (error) {
        console.error("OpenRouter processing error:", error);
        throw new Error(`XML processing failed: ${error.message}`);
    }
}

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

export const createConversion = async (req, res) => {
    try {
        const userId = req.id;
        const userExists = await UserModel.findById(userId);
        if (!userExists) return res.status(400).json({ success: false, message: "User Not Found" });
        if (!req.files?.pdfFile) return res.status(400).json({ error: 'No file uploaded' });

        const pdfFile = req.files.pdfFile;
        if (!pdfFile.mimetype.includes('pdf')) {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        const sanitizedName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const fileName = `conversions/${uuidv4()}-${sanitizedName}`;
    
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            Body: pdfFile.data,
            ContentType: 'application/pdf',
            ACL: 'public-read'
        }));

        const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        const { fullText, noOfPages } = await parsePdfFromUrl(publicUrl);
        console.log("parsedTest",fullText)
        const initialResult = await processTextWithOpenRouter(fullText, process.env.OPENROUTER_API_KEY, "initial");
        console.log("Initial XML    : "+initialResult)
        const refinedResult = await processTextWithOpenRouter(initialResult.xml, process.env.OPENROUTER_API_KEY, "refine");
        console.log("Refind XML    : "+refinedResult)
        const newConversion = await conversionModel.create({
            userId,
            pdfLink: publicUrl,
            xmlContent: refinedResult.xml,
            originalFilename: sanitizedName,
            pdfPages: noOfPages
        });

        return res.status(200).json({
            success: true,
            message: "Successfully generated",
            conversion: newConversion
        });

    } catch (error) {
        console.error('Conversion error:', error);
        return res.status(500).json({ 
            success: false,
            error: 'File upload failed',
            details: error.message
        });
    }
};

export const getAllConversions = async (req, res) => {
    try {
        const userId = req.id;
        const userExists = await UserModel.findById(userId);
        if (!userExists) return res.status(400).json({ success: false, message: "User Not Found" });

        const conversions = await conversionModel.find({ userId });
        return res.status(200).json({
            message: conversions.length > 0 
                ? "Successfully fetched all conversions" 
                : "No conversions found for this user",
            conversions,
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({ message: error.message, success: false });
    }
};

export const getConversionById = async (req, res) => {
    try {
        const { conversionId } = req.params;
        const userId = req.id;

        if (!conversionId) return res.status(400).json({ success: false, message: "Conversion ID required" });
        
        const userExists = await UserModel.findById(userId);
        if (!userExists) return res.status(404).json({ success: false, message: "User not found" });

        const conversion = await conversionModel.findById(conversionId);
        if (!conversion) return res.status(404).json({ success: false, message: "Conversion not found" });
        if (conversion.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        return res.status(200).json({ success: true, conversion, message: "Successfully fetched conversion" });
    } catch (error) {
        console.error("Error in getConversionById:", error);
        if (error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid Conversion ID format" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeConversionById = async (req, res) => {
    try {
        const { conversionId } = req.params;
        const userId = req.id;

        if (!conversionId) return res.status(400).json({ success: false, message: "Conversion ID required" });
        
        const userExists = await UserModel.findById(userId);
        if (!userExists) return res.status(404).json({ success: false, message: "User not found" });

        const conversion = await conversionModel.findById(conversionId);
        if (!conversion) return res.status(404).json({ success: false, message: "Conversion not found" });
        if (conversion.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized: Can only delete your own conversions" });
        }

        await conversionModel.findByIdAndDelete(conversionId);
        return res.status(200).json({ success: true, message: "Conversion deleted successfully" });
    } catch (error) {
        console.error("Delete conversion error:", error);
        if (error.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid Conversion ID format" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};