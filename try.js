import fs from "fs";
import pdf from "pdf-parse";
import { fileURLToPath } from 'url';
import path from 'path';
// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__dirname);
const pdfPath = path.join(__dirname,"sample.pdf"); // Replace with your PDF file path

fs.readFile(pdfPath, async (err, data) => {
    if (err) {
        console.error("Error reading PDF file:", err);
        return;
    }

    try {
        const pdfData = await pdf(data);
        const xmlContent = convertToXML(pdfData.text);
        fs.writeFileSync("output.xml", xmlContent);
        console.log("Converted XML saved as output.xml");
    } catch (error) {
        console.error("Error processing PDF:", error);
    }
});

function convertToXML(text) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?><Document>`;
    text.split("\n").forEach(line => {
        if (line.trim()) {
            xml += `<Paragraph>${line.trim()}</Paragraph>`;
        }
    });
    xml += `</Document>`;
    return xml;
}
