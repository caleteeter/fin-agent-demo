import * as fs from 'fs';
import * as path from 'path';
import { DataGenerator } from './dataGenerator';
import { PDFGenerator } from './pdfGenerator';

async function generateFake10Ks(count: number = 10): Promise<void> {
    const dataGenerator = new DataGenerator();
    const pdfGenerator = new PDFGenerator();

    // create output directory
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Generating ${count} fake 10K documents...`);

    for (let i = 1; i <= count; i++) {
        const company = dataGenerator.generateCompanyData();
        const financial = dataGenerator.generateFinancialData();
        const risks = dataGenerator.generateRiskFactors();

        const pdf = pdfGenerator.generate10K(company, financial, risks);

        const fileName = `10K_${company.ticker}_${i.toString().padStart(3, '0')}.pdf`;
        const filePath = path.join(outputDir, fileName);

        pdf.save(filePath);

        console.log(`Generated: ${fileName} - ${company.name} (${company.ticker})`);
    }

    console.log(`\nAll ${count} documents generated successfully!`);
    console.log(`Output directory: ${outputDir}`);
}

if (require.main === module) {
    const count = process.argv[2] ? parseInt(process.argv[2]) : 10;
    generateFake10Ks(count).catch(console.error);
}

export { generateFake10Ks, DataGenerator, PDFGenerator };