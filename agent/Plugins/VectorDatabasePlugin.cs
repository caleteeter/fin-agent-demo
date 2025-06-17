using Microsoft.SemanticKernel;
using System.ComponentModel;
using System.Text.Json;
using SemanticKernelAgent.Models;

namespace SemanticKernelAgent.Plugins
{
    public class VectorDatabasePlugin
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;

        public VectorDatabasePlugin(HttpClient httpClient, string baseUrl = "http://localhost:3000")
        {
            _httpClient = httpClient;
            _baseUrl = baseUrl.TrimEnd('/');
        }

        [KernelFunction]
        [Description("Search for information about companies using natural language queries. Returns relevant 10K document sections.")]
        public async Task<string> SearchCompanyDataAsync(
            [Description("The search query in natural language (e.g., 'What is Apple's revenue?', 'Show me risk factors for Microsoft')")]
            string query,
            [Description("Maximum number of results to return (1-20, default: 5)")]
            int limit = 5,
            [Description("Filter results to a specific company name or ticker symbol")]
            string? companyFilter = null,
            [Description("Filter by document section type: business, risk_factors, financial_statements, or general")]
            string? sectionType = null)
        {
            try
            {
                var request = new QueryRequest
                {
                    Query = query,
                    Limit = Math.Min(Math.Max(limit, 1), 20),
                    CompanyFilter = companyFilter,
                    ChunkTypeFilter = sectionType
                };

                var json = JsonSerializer.Serialize(request);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{_baseUrl}/api/query", content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return $"Error searching company data: {response.StatusCode} - {responseContent}";
                }

                var apiResponse = JsonSerializer.Deserialize<ApiResponse<List<QueryResult>>>(responseContent);

                if (!apiResponse?.Success ?? false)
                {
                    return $"API Error: {apiResponse?.Error ?? "Unknown error"}";
                }

                if (apiResponse.Data == null || !apiResponse.Data.Any())
                {
                    return "No relevant information found for your query.";
                }

                return FormatSearchResults(apiResponse.Data, query);
            }
            catch (Exception ex)
            {
                return $"Error occurred while searching: {ex.Message}";
            }
        }

        [KernelFunction]
        [Description("Get detailed financial information for a specific company from their 10K filings.")]
        public async Task<string> GetCompanyFinancialsAsync(
            [Description("The company name or ticker symbol")]
            string company,
            [Description("Whether to include detailed context from the documents")]
            bool includeContext = true)
        {
            try
            {
                var request = new CompanyFinancialsRequest
                {
                    CompanyName = company,
                    IncludeContext = includeContext
                };

                var json = JsonSerializer.Serialize(request);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{_baseUrl}/api/company/financials", content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return $"Error retrieving financial data: {response.StatusCode} - {responseContent}";
                }

                var apiResponse = JsonSerializer.Deserialize<ApiResponse<FinancialData>>(responseContent);

                if (!apiResponse?.Success ?? false)
                {
                    return $"API Error: {apiResponse?.Error ?? "Unknown error"}";
                }

                if (apiResponse.Data == null)
                {
                    return $"No financial data found for company: {company}";
                }

                return FormatFinancialData(apiResponse.Data);
            }
            catch (Exception ex)
            {
                return $"Error occurred while retrieving financials: {ex.Message}";
            }
        }

        [KernelFunction]
        [Description("List all companies available in the 10K database.")]
        public async Task<string> ListAvailableCompaniesAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync($"{_baseUrl}/api/companies");
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return $"Error retrieving companies: {response.StatusCode} - {responseContent}";
                }

                var apiResponse = JsonSerializer.Deserialize<ApiResponse<CompanyListResponse>>(responseContent);

                if (!apiResponse?.Success ?? false)
                {
                    return $"API Error: {apiResponse?.Error ?? "Unknown error"}";
                }

                if (apiResponse.Data?.Companies == null || !apiResponse.Data.Companies.Any())
                {
                    return "No companies found in the database.";
                }

                return FormatCompanyList(apiResponse.Data.Companies);
            }
            catch (Exception ex)
            {
                return $"Error occurred while listing companies: {ex.Message}";
            }
        }

        [KernelFunction]
        [Description("Get all available data for a specific company by ticker symbol.")]
        public async Task<string> GetCompanyByTickerAsync(
            [Description("The company ticker symbol (e.g., AAPL, MSFT)")]
            string ticker,
            [Description("Maximum number of document sections to return")]
            int limit = 10)
        {
            try
            {
                var response = await _httpClient.GetAsync($"{_baseUrl}/api/company/{ticker.ToUpper()}?limit={limit}");
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return $"Error retrieving company data: {response.StatusCode} - {responseContent}";
                }

                var apiResponse = JsonSerializer.Deserialize<ApiResponse<dynamic>>(responseContent);

                if (!apiResponse?.Success ?? false)
                {
                    return $"API Error: {apiResponse?.Error ?? "Unknown error"}";
                }

                return $"Retrieved data for ticker {ticker.ToUpper()}: {responseContent}";
            }
            catch (Exception ex)
            {
                return $"Error occurred while retrieving company data: {ex.Message}";
            }
        }

        private static string FormatSearchResults(List<QueryResult> results, string query)
        {
            var formatted = new System.Text.StringBuilder();
            formatted.AppendLine($"Search Results for: '{query}'");
            formatted.AppendLine($"Found {results.Count} relevant sections:\n");

            for (int i = 0; i < results.Count; i++)
            {
                var result = results[i];
                formatted.AppendLine($"[{i + 1}] {result.CompanyName} ({result.TickerSymbol})");
                formatted.AppendLine($"Section: {result.ChunkType.Replace("_", " ").ToTitleCase()}");
                
                if (result.SimilarityScore.HasValue)
                {
                    formatted.AppendLine($"Relevance: {result.SimilarityScore.Value:P1}");
                }
                
                formatted.AppendLine($"Content: {TruncateText(result.Content, 300)}");
                formatted.AppendLine();
            }

            return formatted.ToString();
        }

        private static string FormatFinancialData(FinancialData data)
        {
            var formatted = new System.Text.StringBuilder();
            formatted.AppendLine($"Financial Summary for {data.CompanyName}:");
            formatted.AppendLine();

            if (data.FinancialSummary != null && data.FinancialSummary.Any())
            {
                foreach (var metric in data.FinancialSummary)
                {
                    formatted.AppendLine($"{metric.Key.Replace("_", " ").ToTitleCase()}: {metric.Value}");
                }
            }
            else
            {
                formatted.AppendLine("No financial metrics extracted.");
            }

            if (data.Context != null && data.Context.Any())
            {
                formatted.AppendLine("\nRelevant Financial Document Sections:");
                for (int i = 0; i < Math.Min(data.Context.Count, 3); i++)
                {
                    var context = data.Context[i];
                    formatted.AppendLine($"\n[{i + 1}] {context.ChunkType.Replace("_", " ").ToTitleCase()}:");
                    formatted.AppendLine(TruncateText(context.Content, 200));
                }
            }

            return formatted.ToString();
        }

        private static string FormatCompanyList(List<Company> companies)
        {
            var formatted = new System.Text.StringBuilder();
            formatted.AppendLine($"Available Companies ({companies.Count} total):");
            formatted.AppendLine();

            foreach (var company in companies.OrderBy(c => c.CompanyName))
            {
                formatted.AppendLine($"• {company.CompanyName} ({company.TickerSymbol})");
            }

            return formatted.ToString();
        }

        private static string TruncateText(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
                return text;

            return text.Substring(0, maxLength) + "...";
        }
    }

    public static class StringExtensions
    {
        public static string ToTitleCase(this string input)
        {
            if (string.IsNullOrEmpty(input))
                return input;

            return System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(input.ToLower());
        }
    }
} 