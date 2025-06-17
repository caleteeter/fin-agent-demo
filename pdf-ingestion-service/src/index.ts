import * as fs from 'fs';
import * as path from 'path';
import { connect, Table } from '@lancedb/lancedb';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import * as dotenv from 'dotenv';

dotenv.config();

// Types
interface DocumentChunk extends Record<string, unknown> {
  id: string;
  company_name: string;
  ticker_symbol: string;
  content: string;
  chunk_type: 'business' | 'risk_factors' | 'financial_statements' | 'general';
  metadata: {
    source_file: string;
    page_number?: number;
    section?: string;
  };
  vector: number[];
}

interface FinancialData {
  revenue?: number;
  gross_profit?: number;
  operating_income?: number;
  net_income?: number;
  total_assets?: number;
  cash?: number;
  total_liabilities?: number;
  long_term_debt?: number;
  shareholders_equity?: number;
}

interface CompanyInfo {
  name: string;
  ticker: string;
  industry?: string;
  employees?: number;
  headquarters?: string;
  financial_data?: FinancialData;
}

class PDFVectorDB {
  private openai: OpenAI;
  private db: any;
  private table: Table | null = null;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });
  }

  async initialize(): Promise<void> {
    // Connect to LanceDB (in-memory)
    this.db = await connect('./lancedb');
    
    try {
      // Try to open existing table
      this.table = await this.db.openTable('company_documents');
      console.log('Opened existing table');
    } catch (error) {
      // Create new table if it doesn't exist
      console.log('Creating new table');
      // Create a sample record to define the schema
      const sampleVector = new Array(1536).fill(0); // text-embedding-3-small produces 1536-dimensional vectors
      const sampleData: DocumentChunk[] = [{
        id: 'sample_chunk_id',
        company_name: 'Sample Company',
        ticker_symbol: 'SMPL',
        content: 'This is a sample document chunk used for schema definition.',
        chunk_type: 'general',
        metadata: {
          source_file: 'sample.pdf',
          page_number: 1,
          section: 'Sample Section'
        },
        vector: sampleVector
      }];
      
      this.table = await this.db.createTable('company_documents', sampleData);
      
      // Remove the sample record after table creation
      await this.table?.delete('id = "sample_chunk_id"');
      console.log('Created new table and removed sample record');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  extractCompanyInfo(text: string): CompanyInfo {
    const companyInfo: CompanyInfo = {
      name: '',
      ticker: '',
    };

    // Extract company name (look for company name patterns)
    const nameMatch = text.match(/^([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Corporation|Company|Ltd|LLC))/m);
    if (nameMatch) {
      companyInfo.name = nameMatch[1].trim();
    }

    // Extract ticker symbol
    const tickerMatch = text.match(/Ticker Symbol:\s*([A-Z]{1,5})/i);
    if (tickerMatch) {
      companyInfo.ticker = tickerMatch[1];
    }

    // Extract industry
    const industryMatch = text.match(/Industry:\s*([^\n\r]+)/i);
    if (industryMatch) {
      companyInfo.industry = industryMatch[1].trim();
    }

    // Extract employees
    const employeesMatch = text.match(/Employees:\s*([\d,]+)/i);
    if (employeesMatch) {
      companyInfo.employees = parseInt(employeesMatch[1].replace(/,/g, ''));
    }

    // Extract headquarters
    const hqMatch = text.match(/Headquarters:\s*([^\n\r]+)/i);
    if (hqMatch) {
      companyInfo.headquarters = hqMatch[1].trim();
    }

    // Extract financial data
    const financialData: FinancialData = {};
    
    const revenueMatch = text.match(/Revenue\s*\$?([\d,]+)/i);
    if (revenueMatch) {
      financialData.revenue = parseInt(revenueMatch[1].replace(/,/g, '')) * 1000; // Convert to actual dollars
    }

    const grossProfitMatch = text.match(/Gross Profit\s*\$?([\d,]+)/i);
    if (grossProfitMatch) {
      financialData.gross_profit = parseInt(grossProfitMatch[1].replace(/,/g, '')) * 1000;
    }

    const operatingIncomeMatch = text.match(/Operating Income\s*\$?([\d,]+)/i);
    if (operatingIncomeMatch) {
      financialData.operating_income = parseInt(operatingIncomeMatch[1].replace(/,/g, '')) * 1000;
    }

    const netIncomeMatch = text.match(/Net Income\s*\$?([\d,]+)/i);
    if (netIncomeMatch) {
      financialData.net_income = parseInt(netIncomeMatch[1].replace(/,/g, '')) * 1000;
    }

    const totalAssetsMatch = text.match(/Total Assets\s*\$?([\d,]+)/i);
    if (totalAssetsMatch) {
      financialData.total_assets = parseInt(totalAssetsMatch[1].replace(/,/g, '')) * 1000;
    }

    const cashMatch = text.match(/Cash and Cash Equivalents\s*\$?([\d,]+)/i);
    if (cashMatch) {
      financialData.cash = parseInt(cashMatch[1].replace(/,/g, '')) * 1000;
    }

    const totalLiabilitiesMatch = text.match(/Total Liabilities\s*\$?([\d,]+)/i);
    if (totalLiabilitiesMatch) {
      financialData.total_liabilities = parseInt(totalLiabilitiesMatch[1].replace(/,/g, '')) * 1000;
    }

    const longTermDebtMatch = text.match(/Long-term Debt\s*\$?([\d,]+)/i);
    if (longTermDebtMatch) {
      financialData.long_term_debt = parseInt(longTermDebtMatch[1].replace(/,/g, '')) * 1000;
    }

    const shareholdersEquityMatch = text.match(/Shareholders['\s]*Equity\s*\$?([\d,]+)/i);
    if (shareholdersEquityMatch) {
      financialData.shareholders_equity = parseInt(shareholdersEquityMatch[1].replace(/,/g, '')) * 1000;
    }

    if (Object.keys(financialData).length > 0) {
      companyInfo.financial_data = financialData;
    }

    return companyInfo;
  }

  chunkDocument(text: string, companyInfo: CompanyInfo, sourceFile: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Split by major sections
    const sections = text.split(/(?=PART\s+[IVX]+|Item\s+\d+)/);
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (section.length < 100) continue; // Skip very short sections
      
      // Determine chunk type based on content
      let chunkType: DocumentChunk['chunk_type'] = 'general';
      let sectionName = '';
      
      if (section.includes('Item 1. Business')) {
        chunkType = 'business';
        sectionName = 'Business Overview';
      } else if (section.includes('Item 2. Risk Factors')) {
        chunkType = 'risk_factors';
        sectionName = 'Risk Factors';
      } else if (section.includes('Financial Statements')) {
        chunkType = 'financial_statements';
        sectionName = 'Financial Statements';
      }
      
      // Further split large sections into smaller chunks
      const maxChunkSize = 1000;
      const sentences = section.split(/[.!?]+/);
      let currentChunk = '';
      let chunkIndex = 0;
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push({
            id: `${companyInfo.ticker || 'unknown'}_${i}_${chunkIndex}`,
            company_name: companyInfo.name,
            ticker_symbol: companyInfo.ticker,
            content: currentChunk.trim(),
            chunk_type: chunkType,
            metadata: {
              source_file: sourceFile,
              section: sectionName,
            },
            vector: [], // Will be filled later
          });
          
          currentChunk = sentence;
          chunkIndex++;
        } else {
          currentChunk += sentence + '.';
        }
      }
      
      // Add the last chunk if it has content
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: `${companyInfo.ticker || 'unknown'}_${i}_${chunkIndex}`,
          company_name: companyInfo.name,
          ticker_symbol: companyInfo.ticker,
          content: currentChunk.trim(),
          chunk_type: chunkType,
          metadata: {
            source_file: sourceFile,
            section: sectionName,
          },
          vector: [], // Will be filled later
        });
      }
    }
    
    return chunks;
  }

  async ingestPDF(filePath: string): Promise<void> {
    try {
      console.log(`Processing PDF: ${filePath}`);
      
      // Read and parse PDF
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      const text = pdfData.text;
      
      // Extract company information
      const companyInfo = this.extractCompanyInfo(text);
      console.log('Extracted company info:', companyInfo);
      
      // Chunk the document
      const chunks = this.chunkDocument(text, companyInfo, path.basename(filePath));
      console.log(`Created ${chunks.length} chunks`);
      
      // Generate embeddings for each chunk
      for (const chunk of chunks) {
        console.log(`Generating embedding for chunk: ${chunk.id}`);
        chunk.vector = await this.generateEmbedding(chunk.content);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Insert chunks into the database
      if (this.table) {
        await this.table.add(chunks);
        console.log(`Successfully ingested ${chunks.length} chunks for ${companyInfo.name}`);
      }
      
    } catch (error) {
      console.error(`Error processing PDF ${filePath}:`, error);
      throw error;
    }
  }

  async ingestPDFDirectory(directoryPath: string): Promise<void> {
    try {
      console.log(`Processing directory: ${directoryPath}`);
      
      // Check if directory exists
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory does not exist: ${directoryPath}`);
      }
      
      // Check if it's actually a directory
      const stats = fs.statSync(directoryPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${directoryPath}`);
      }
      
      // Read all files in the directory
      const files = fs.readdirSync(directoryPath);
      
      // Filter for PDF files
      const pdfFiles = files.filter(file => 
        path.extname(file).toLowerCase() === '.pdf'
      );
      
      if (pdfFiles.length === 0) {
        console.log('No PDF files found in the directory');
        return;
      }
      
      console.log(`Found ${pdfFiles.length} PDF files to process`);
      
      // Process each PDF file
      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        const fullPath = path.join(directoryPath, pdfFile);
        
        console.log(`\n[${i + 1}/${pdfFiles.length}] Processing: ${pdfFile}`);
        
        try {
          await this.ingestPDF(fullPath);
          console.log(`✓ Successfully processed: ${pdfFile}`);
        } catch (error) {
          console.error(`✗ Failed to process ${pdfFile}:`, error);
          // Continue processing other files even if one fails
        }
        
        // Add a longer delay between files to be more respectful to the API
        if (i < pdfFiles.length - 1) {
          console.log('Waiting before processing next file...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`\nCompleted processing directory. Processed ${pdfFiles.length} PDF files.`);
      
    } catch (error) {
      console.error('Error processing directory:', error);
      throw error;
    }
  }

  async queryCompany(query: string, limit: number = 5): Promise<any[]> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Generate embedding for the query
      const queryVector = await this.generateEmbedding(query);
      
      // Search for similar chunks
      const results = await this.table
        .search(queryVector)
        .limit(limit)
        .toArray();
      
      return results;
    } catch (error) {
      console.error('Error querying database:', error);
      throw error;
    }
  }

  async getCompanyFinancials(companyName: string): Promise<any> {
    const query = `${companyName} revenue financial statements income profit assets`;
    const results = await this.queryCompany(query, 10);
    
    // Filter for financial statements and business info
    const financialChunks = results.filter(r => 
      r.chunk_type === 'financial_statements' || 
      r.chunk_type === 'business' ||
      r.content.toLowerCase().includes('revenue') ||
      r.content.toLowerCase().includes('income') ||
      r.content.toLowerCase().includes('profit')
    );
    
    return {
      company_name: companyName,
      financial_data: financialChunks,
      summary: this.summarizeFinancials(financialChunks)
    };
  }

  private summarizeFinancials(chunks: any[]): string {
    const relevantInfo = chunks
      .map(chunk => chunk.content)
      .join(' ')
      .toLowerCase();
    
    const summary: string[] = [];
    
    // Extract key financial metrics
    const revenueMatch = relevantInfo.match(/revenue\s*\$?([\d,]+)/i);
    if (revenueMatch) {
      summary.push(`Revenue: $${revenueMatch[1]}`);
    }
    
    const netIncomeMatch = relevantInfo.match(/net income\s*\$?([\d,]+)/i);
    if (netIncomeMatch) {
      summary.push(`Net Income: $${netIncomeMatch[1]}`);
    }
    
    const assetsMatch = relevantInfo.match(/total assets\s*\$?([\d,]+)/i);
    if (assetsMatch) {
      summary.push(`Total Assets: $${assetsMatch[1]}`);
    }
    
    return summary.join(', ') || 'No financial summary available';
  }
}

// Usage example
async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  const vectorDB = new PDFVectorDB(apiKey);
  await vectorDB.initialize();
  
  // Ingest PDFs
 await vectorDB.ingestPDFDirectory('../data-generator/output');
  
  // Query examples
  console.log('\n--- Querying for Batz Inc revenue ---');
  const revenueResults = await vectorDB.queryCompany('Batz Inc revenue financial performance');
  console.log(revenueResults.slice(0, 3));
  
  console.log('\n--- Getting company financials ---');
  const financials = await vectorDB.getCompanyFinancials('Batz Inc');
  console.log(financials.summary);
  
  console.log('\n--- Querying for risk factors ---');
  const riskResults = await vectorDB.queryCompany('Batz Inc risk factors market competition');
  console.log(riskResults.slice(0, 2));
}

// Export the class for use in other files
export { PDFVectorDB, DocumentChunk, CompanyInfo, FinancialData };

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}