import { jsPDF } from 'jspdf';
import { CompanyData, FinancialData, RiskFactor } from './types';
import { DataGenerator } from './dataGenerator';

export class PDFGenerator {
    private dataGenerator: DataGenerator;

    constructor() {
        this.dataGenerator = new DataGenerator();
    }

    generate10K(company: CompanyData, financial: FinancialData, risks: RiskFactor[]): jsPDF {
        const doc = new jsPDF();
        let yPosition = 20;
        
        // Title Page
        doc.setFontSize(20);
        doc.text('UNITED STATES', 105, yPosition, { align: 'center' });
        yPosition += 10;
        doc.text('SECURITIES AND EXCHANGE COMMISSION', 105, yPosition, { align: 'center' });
        yPosition += 10;
        doc.text('Washington, D.C. 20549', 105, yPosition, { align: 'center' });
        yPosition += 20;
        
        doc.setFontSize(16);
        doc.text('FORM 10-K', 105, yPosition, { align: 'center' });
        yPosition += 15;
    
        doc.setFontSize(12);
        doc.text('ANNUAL REPORT PURSUANT TO SECTION 13 OR 15(d)', 105, yPosition, { align: 'center' });
        yPosition += 5;
        doc.text('OF THE SECURITIES EXCHANGE ACT OF 1934', 105, yPosition, { align: 'center' });
        yPosition += 20;
        
        // Company Information
        doc.setFontSize(14);
        doc.text(company.name, 105, yPosition, { align: 'center' });
        yPosition += 10;
        doc.setFontSize(10);
        doc.text(`Ticker Symbol: ${company.ticker}`, 105, yPosition, { align: 'center' });
        yPosition += 5;
        doc.text(`CIK: ${company.cik}`, 105, yPosition, { align: 'center' });
        yPosition += 15;
        
        // New page for content
        doc.addPage();
        yPosition = 20;
    
        // Table of Contents
        doc.setFontSize(16);
        doc.text('TABLE OF CONTENTS', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(10);
        const tocItems = [
            'PART I',
            'Item 1. Business',
            'Item 2. Risk Factors',
            'Item 3. Legal Proceedings',
            'PART II',
            'Item 5. Market for Common Equity',
            'Item 7. Management\'s Discussion and Analysis',
            'Item 8. Financial Statements and Supplementary Data'
        ];
        
        tocItems.forEach(item => {
        doc.text(item, 25, yPosition);
        yPosition += 7;
        });
    
        // Business Section
        doc.addPage();
        yPosition = 20;
        
        doc.setFontSize(14);
        doc.text('PART I', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(12);
        doc.text('Item 1. Business', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(10);
        const businessDesc = this.dataGenerator.generateBusinessDescription().replace('{industry}', company.industry);
        const businessLines = doc.splitTextToSize(businessDesc, 170);
        businessLines.forEach((line: string) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            doc.text(line, 20, yPosition);
            yPosition += 5;
        });
    
        yPosition += 10;
        doc.text(`Industry: ${company.industry}`, 20, yPosition);
        yPosition += 7;
        doc.text(`Employees: ${this.dataGenerator.formatNumber(company.employees)}`, 20, yPosition);
        yPosition += 7;
        doc.text(`Headquarters: ${company.headquarters}`, 20, yPosition);
        
        // Risk Factors
        doc.addPage();
        yPosition = 20;
        
        doc.setFontSize(12);
        doc.text('Item 2. Risk Factors', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(10);
        risks.forEach((risk, index) => {
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }
      
            doc.setFont('helvetica', 'bold');
            const titleLines = doc.splitTextToSize(risk.title, 170);
            titleLines.forEach((line: string) => {
                doc.text(line, 20, yPosition);
                yPosition += 5;
            });
        
            doc.setFont('helvetica', 'normal');
            yPosition += 3;
            const descLines = doc.splitTextToSize(risk.description, 170);
            descLines.forEach((line: string) => {
                if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
                }
                doc.text(line, 20, yPosition);
                yPosition += 5;
            });
            yPosition += 10;
        });
    
        // Financial Statements
        doc.addPage();
        yPosition = 20;
        
        doc.setFontSize(14);
        doc.text('PART II', 20, yPosition);
        yPosition += 15;
    
        doc.setFontSize(12);
        doc.text('Item 8. Financial Statements and Supplementary Data', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(11);
        doc.text('CONSOLIDATED STATEMENTS OF OPERATIONS', 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(9);
        doc.text('(In thousands, except per share data)', 20, yPosition);
        yPosition += 15;
    
        // Income Statement
        const incomeStatement = [
        ['Revenue', this.dataGenerator.formatCurrency(financial.revenue / 1000)],
        ['Gross Profit', this.dataGenerator.formatCurrency(financial.grossProfit / 1000)],
        ['Operating Income', this.dataGenerator.formatCurrency(financial.operatingIncome / 1000)],
        ['Net Income', this.dataGenerator.formatCurrency(financial.netIncome / 1000)]
        ];
    
        incomeStatement.forEach(([label, value]) => {
        doc.text(label, 20, yPosition);
        doc.text(value, 150, yPosition);
        yPosition += 7;
        });
    
        yPosition += 15;
        doc.setFontSize(11);
        doc.text('CONSOLIDATED BALANCE SHEETS', 20, yPosition);
        yPosition += 15;
    
        // Balance Sheet
        const balanceSheet = [
            ['Total Assets', this.dataGenerator.formatCurrency(financial.totalAssets / 1000)],
            ['Cash and Cash Equivalents', this.dataGenerator.formatCurrency(financial.cashAndEquivalents / 1000)],
            ['Total Liabilities', this.dataGenerator.formatCurrency(financial.totalLiabilities / 1000)],
            ['Long-term Debt', this.dataGenerator.formatCurrency(financial.longTermDebt / 1000)],
            ['Shareholders\' Equity', this.dataGenerator.formatCurrency(financial.shareholderEquity / 1000)]
        ];
    
        doc.setFontSize(9);
        balanceSheet.forEach(([label, value]) => {
        doc.text(label, 20, yPosition);
        doc.text(value, 150, yPosition);
        yPosition += 7;
        });
    
        return doc;
    }
}