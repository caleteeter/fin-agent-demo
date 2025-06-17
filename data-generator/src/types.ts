
export interface CompanyData {
    name: string;
    ticker: string;
    cik: string;
    industry: string;
    employees: number;
    headquarters: string;
}

export interface FinancialData {
    revenue: number;
    grossProfit: number;
    operatingIncome: number;
    netIncome: number;
    totalAssets: number;
    totalLiabilities: number;
    shareholderEquity: number;
    cashAndEquivalents: number;
    longTermDebt: number;
}

export interface RiskFactor {
    title: string;
    description: string;
}