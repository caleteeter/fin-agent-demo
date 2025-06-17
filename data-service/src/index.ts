import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connect, Table } from '@lancedb/lancedb';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Types (matching the ingestion system)
interface DocumentChunk {
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

interface QueryRequest {
  query: string;
  limit?: number;
  company_filter?: string;
  chunk_type_filter?: 'business' | 'risk_factors' | 'financial_statements' | 'general';
}

interface CompanyFinancialsRequest {
  company_name: string;
  include_context?: boolean;
}

interface QueryResponse {
  success: boolean;
  data?: any;
  error?: string;
  meta?: {
    query: string;
    results_count: number;
    processing_time_ms: number;
  };
}

class VectorQueryAPI {
  private app: express.Application;
  private openai: OpenAI;
  private db: any;
  private table: Table | null = null;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    //this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database_connected: this.table !== null
      });
    });

    // Vector search endpoint
    this.app.post('/api/query', async (req: any, res: any) => {
      const startTime = Date.now();
      
      try {
        const { query, limit = 5, company_filter, chunk_type_filter }: QueryRequest = req.body;
        
        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Query parameter is required and must be a string'
          });
        }

        if (limit < 1 || limit > 100) {
          return res.status(400).json({
            success: false,
            error: 'Limit must be between 1 and 100'
          });
        }

        const results = await this.performVectorSearch(query, limit, company_filter, chunk_type_filter);
        const processingTime = Date.now() - startTime;

        res.json({
          success: true,
          data: results,
          meta: {
            query,
            results_count: results.length,
            processing_time_ms: processingTime
          }
        });

      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('Query error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error during query processing',
          meta: {
            processing_time_ms: processingTime
          }
        });
      }
    });

    // Company financials endpoint
    this.app.post('/api/company/financials', async (req: any, res: any) => {
      const startTime = Date.now();
      
      try {
        const { company_name, include_context = false }: CompanyFinancialsRequest = req.body;
        
        if (!company_name || typeof company_name !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Company name is required and must be a string'
          });
        }

        const results = await this.getCompanyFinancials(company_name, include_context);
        const processingTime = Date.now() - startTime;

        res.json({
          success: true,
          data: results,
          meta: {
            query: `Financial data for ${company_name}`,
            results_count: results.financial_chunks?.length || 0,
            processing_time_ms: processingTime
          }
        });

      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('Financials error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error during financials processing',
          meta: {
            processing_time_ms: processingTime
          }
        });
      }
    });

    // List companies endpoint
    this.app.get('/api/companies', async (req: Request, res: Response) => {
      try {
        const companies = await this.listCompanies();
        
        res.json({
          success: true,
          data: {
            companies: companies,
            total_count: companies.length
          }
        });

      } catch (error) {
        console.error('List companies error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error while fetching companies'
        });
      }
    });

    // Search by company endpoint
    this.app.get('/api/company/:ticker', async (req: any, res: any) => {
      try {
        const { ticker } = req.params;
        const { limit = 10 } = req.query;
        
        const companyData = await this.getCompanyByTicker(ticker, Number(limit));
        
        if (!companyData || companyData.length === 0) {
          return res.status(404).json({
            success: false,
            error: `No data found for company with ticker: ${ticker}`
          });
        }

        res.json({
          success: true,
          data: {
            ticker: ticker,
            chunks: companyData,
            total_chunks: companyData.length
          }
        });

      } catch (error) {
        console.error('Company lookup error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error during company lookup'
        });
      }
    });

    // Database stats endpoint
    this.app.get('/api/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.getDatabaseStats();
        
        res.json({
          success: true,
          data: stats
        });

      } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error while fetching database stats'
        });
      }
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  private async performVectorSearch(
    query: string, 
    limit: number, 
    companyFilter?: string, 
    chunkTypeFilter?: string
  ): Promise<any[]> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    // Generate embedding for the query
    const queryVector = await this.generateEmbedding(query);

    // Build the search query
    let searchQuery = this.table.search(queryVector).limit(limit);

    // Apply filters if provided
    const filters: string[] = [];
    
    if (companyFilter) {
      filters.push(`company_name LIKE '%${companyFilter}%' OR ticker_symbol = '${companyFilter.toUpperCase()}'`);
    }
    
    if (chunkTypeFilter) {
      filters.push(`chunk_type = '${chunkTypeFilter}'`);
    }

    if (filters.length > 0) {
      searchQuery = searchQuery.where(filters.join(' AND '));
    }

    const results = await searchQuery.toArray();
    
    // Add similarity score and clean up the response
    return results.map((result: any) => ({
      id: result.id,
      company_name: result.company_name,
      ticker_symbol: result.ticker_symbol,
      content: result.content,
      chunk_type: result.chunk_type,
      metadata: result.metadata,
      similarity_score: result._distance ? (1 - result._distance) : null
    }));
  }

  private async getCompanyFinancials(companyName: string, includeContext: boolean = false): Promise<any> {
    const query = `${companyName} revenue financial statements income profit assets cash liabilities equity`;
    const results = await this.performVectorSearch(query, 20, companyName);

    // Filter for financial-related content
    const financialChunks = results.filter(r => 
      r.chunk_type === 'financial_statements' || 
      r.content.toLowerCase().includes('revenue') ||
      r.content.toLowerCase().includes('income') ||
      r.content.toLowerCase().includes('profit') ||
      r.content.toLowerCase().includes('assets') ||
      r.content.toLowerCase().includes('cash') ||
      r.content.toLowerCase().includes('liabilities')
    );

    const summary = this.extractFinancialMetrics(financialChunks);

    return {
      company_name: companyName,
      financial_summary: summary,
      financial_chunks: includeContext ? financialChunks : financialChunks.length,
      context: includeContext ? financialChunks : null
    };
  }

  private extractFinancialMetrics(chunks: any[]): any {
    const allContent = chunks.map(chunk => chunk.content).join(' ').toLowerCase();
    const metrics: any = {};

    // Extract financial metrics using regex
    const patterns = {
      revenue: /revenue\s*\$?([\d,]+)/i,
      net_income: /net income\s*\$?([\d,]+)/i,
      gross_profit: /gross profit\s*\$?([\d,]+)/i,
      operating_income: /operating income\s*\$?([\d,]+)/i,
      total_assets: /total assets\s*\$?([\d,]+)/i,
      cash: /cash and cash equivalents\s*\$?([\d,]+)/i,
      total_liabilities: /total liabilities\s*\$?([\d,]+)/i,
      shareholders_equity: /shareholders['\s]*equity\s*\$?([\d,]+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = allContent.match(pattern);
      if (match) {
        metrics[key] = `$${match[1]}`;
      }
    }

    return metrics;
  }

  private async listCompanies(): Promise<any[]> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const results = await this.table
      .query()
      .select(['company_name', 'ticker_symbol'])
      .toArray();

    // Get unique companies
    const uniqueCompanies = new Map();
    
    results.forEach((result: any) => {
      const key = result.ticker_symbol || result.company_name;
      if (!uniqueCompanies.has(key)) {
        uniqueCompanies.set(key, {
          company_name: result.company_name,
          ticker_symbol: result.ticker_symbol
        });
      }
    });

    return Array.from(uniqueCompanies.values());
  }

  private async getCompanyByTicker(ticker: string, limit: number): Promise<any[]> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const results = await this.table
      .query()
      .where(`ticker_symbol = '${ticker.toUpperCase()}'`)
      .limit(limit)
      .toArray();

    return results.map((result: any) => ({
      id: result.id,
      company_name: result.company_name,
      ticker_symbol: result.ticker_symbol,
      content: result.content,
      chunk_type: result.chunk_type,
      metadata: result.metadata
    }));
  }

  private async getDatabaseStats(): Promise<any> {
    if (!this.table) {
      throw new Error('Database not initialized');
    }

    const allRecords = await this.table.query().select(['company_name', 'ticker_symbol', 'chunk_type']).toArray();
    
    const stats = {
      total_chunks: allRecords.length,
      unique_companies: new Set(allRecords.map((r: any) => r.ticker_symbol || r.company_name)).size,
      chunk_types: {} as any,
      companies: {} as any
    };

    // Count chunk types
    allRecords.forEach((record: any) => {
      stats.chunk_types[record.chunk_type] = (stats.chunk_types[record.chunk_type] || 0) + 1;
      const company = record.ticker_symbol || record.company_name;
      stats.companies[company] = (stats.companies[company] || 0) + 1;
    });

    return stats;
  }

  async initialize(): Promise<void> {
    try {
      // Connect to the existing LanceDB database
      const dbPath = process.env.LANCEDB_PATH || './lancedb';
      this.db = await connect(dbPath);

      console.log(`Connecting to LanceDB at ${dbPath}...`);
      
      // Open the existing table
      this.table = await this.db.openTable('company_documents');
      console.log('Successfully connected to LanceDB');
      
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw new Error('Database connection failed. Make sure the database exists and PDFs have been ingested.');
    }
  }

  async start(): Promise<void> {
    await this.initialize();
    
    this.app.listen(this.port, () => {
      console.log(`Vector Query API server running on port ${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
      console.log(`API documentation available at endpoints:`);
      console.log(`  POST /api/query - Vector search`);
      console.log(`  POST /api/company/financials - Company financials`);
      console.log(`  GET /api/companies - List all companies`);
      console.log(`  GET /api/company/:ticker - Get company data by ticker`);
      console.log(`  GET /api/stats - Database statistics`);
    });
  }
}

// Usage
async function main() {
  const port = Number(process.env.PORT) || 3000;
  const api = new VectorQueryAPI(port);

  await api.initialize();
  
  try {
    await api.start();
  } catch (error) {
    console.error('Failed to start API server:', error);
    process.exit(1);
  }
}

// Export for use as module
export { VectorQueryAPI };

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}