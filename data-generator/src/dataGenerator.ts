import * as faker from 'faker';
import { CompanyData, FinancialData, RiskFactor } from './types';

export class DataGenerator {
    private industries = [
        'Technology', 'Healthcare', 'Financial Services', 'Manufacturing',
        'Retail', 'Energy', 'Telecommunications', 'Aerospace', 'Automotive',
        'Pharmaceuticals', 'Real Estate', 'Consumer Goods'
    ];

    private riskFactorTemplates = [
        {
            title: 'Market Competition',
            description: 'We face intense competition from established companies and new entrants in our market segments. This competition may result in price reductions, reduced margins, and loss of market share.'
        },
        {
            title: 'Regulatory Changes',
            description: 'Changes in government regulations and policies could adversely affect our business operations, compliance costs, and strategic initiatives.'
        },
        {
            title: 'Cybersecurity Threats',
            description: 'Cybersecurity incidents could result in data breaches, operational disruptions, and damage to our reputation and customer relationships.'
        },
        {
            title: 'Supply Chain Disruptions',
            description: 'Disruptions to our supply chain, including those caused by natural disasters, geopolitical events, or pandemic conditions, could impact our ability to meet customer demand.'
        },
        {
            title: 'Economic Conditions',
            description: 'Economic downturns, inflation, or changes in interest rates could negatively impact consumer spending and demand for our products and services.'
        },
        {
            title: 'Talent Acquisition and Retention',
            description: 'Our success depends on our ability to attract, develop, and retain qualified personnel. Competition for skilled employees may increase our labor costs.'
        }
    ];

    generateCompanyData(): CompanyData {
        const companyName = faker.company.companyName();
        return {
            name: companyName,
            ticker: this.generateTicker(companyName),
            cik: faker.datatype.number({ min: 1000000, max: 9999999 }).toString().padStart(10, '0'),
            industry: faker.random.arrayElement(this.industries),
            employees: faker.datatype.number({ min: 100, max: 500000 }),
            headquarters: `${faker.address.city()}, ${faker.address.stateAbbr()}`
        };
    }

    generateFinancialData(): FinancialData {
        const revenue = faker.datatype.number({ min: 50000000, max: 100000000000 });
        const grossProfitMargin = faker.datatype.float({ min: 0.2, max: 0.7, precision: 0.01 });
        const operatingMargin = faker.datatype.float({ min: 0.05, max: 0.3, precision: 0.01 });
        const netMargin = faker.datatype.float({ min: 0.02, max: 0.25, precision: 0.01 });
        
        const grossProfit = Math.round(revenue * grossProfitMargin);
        const operatingIncome = Math.round(revenue * operatingMargin);
        const netIncome = Math.round(revenue * netMargin);
        
        const totalAssets = faker.datatype.number({ min: revenue * 0.5, max: revenue * 3 });
        const totalLiabilities = Math.round(totalAssets * faker.datatype.float({ min: 0.3, max: 0.7, precision: 0.01 }));
        const shareholderEquity = totalAssets - totalLiabilities;
        
        return {
            revenue,
            grossProfit,
            operatingIncome,
            netIncome,
            totalAssets,
            totalLiabilities,
            shareholderEquity,
            cashAndEquivalents: faker.datatype.number({ min: totalAssets * 0.05, max: totalAssets * 0.3 }),
            longTermDebt: faker.datatype.number({ min: 0, max: totalLiabilities * 0.6 })
        };
    }

    generateRiskFactors(count: number = 6): RiskFactor[] {
        return faker.random.arrayElements(this.riskFactorTemplates, count);
    }

    generateBusinessDescription(): string {
        const templates = [
            `We are a leading provider of innovative solutions in the {industry} sector. Our company specializes in developing and delivering high-quality products and services that meet the evolving needs of our customers worldwide.`,
            `Our company operates as a diversified {industry} enterprise, offering a comprehensive portfolio of products and services. We serve customers across multiple market segments through our integrated business model.`,
            `We design, manufacture, and distribute products and services primarily in the {industry} industry. Our operations span multiple geographic regions, serving both domestic and international markets.`
        ];

        return faker.random.arrayElement(templates);
    }

    private generateTicker(companyName: string): string {
        const words = companyName.split(' ').filter(word => word.length > 2);
        if (words.length < 2) {
            return (words[0].substring(0, 2) + words[1].substring(0, 2)).toUpperCase();
        }
        return companyName.substring(0, 4).toUpperCase();
    }

    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    formatNumber(amount: number): string {
        return new Intl.NumberFormat('en-US').format(amount);
    }
}