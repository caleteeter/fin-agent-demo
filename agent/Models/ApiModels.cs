 using System.Text.Json.Serialization;

namespace SemanticKernelAgent.Models
{
    public class QueryRequest
    {
        [JsonPropertyName("query")]
        public string Query { get; set; } = string.Empty;

        [JsonPropertyName("limit")]
        public int? Limit { get; set; }

        [JsonPropertyName("company_filter")]
        public string? CompanyFilter { get; set; }

        [JsonPropertyName("chunk_type_filter")]
        public string? ChunkTypeFilter { get; set; }
    }

    public class CompanyFinancialsRequest
    {
        [JsonPropertyName("company_name")]
        public string CompanyName { get; set; } = string.Empty;

        [JsonPropertyName("include_context")]
        public bool IncludeContext { get; set; } = true;
    }

    public class ApiResponse<T>
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("data")]
        public T? Data { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("meta")]
        public ResponseMeta? Meta { get; set; }
    }

    public class ResponseMeta
    {
        [JsonPropertyName("query")]
        public string? Query { get; set; }

        [JsonPropertyName("results_count")]
        public int ResultsCount { get; set; }

        [JsonPropertyName("processing_time_ms")]
        public int ProcessingTimeMs { get; set; }
    }

    public class QueryResult
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("company_name")]
        public string CompanyName { get; set; } = string.Empty;

        [JsonPropertyName("ticker_symbol")]
        public string TickerSymbol { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("chunk_type")]
        public string ChunkType { get; set; } = string.Empty;

        [JsonPropertyName("metadata")]
        public Dictionary<string, object>? Metadata { get; set; }

        [JsonPropertyName("similarity_score")]
        public double? SimilarityScore { get; set; }
    }

    public class Company
    {
        [JsonPropertyName("company_name")]
        public string CompanyName { get; set; } = string.Empty;

        [JsonPropertyName("ticker_symbol")]
        public string TickerSymbol { get; set; } = string.Empty;
    }

    public class CompanyListResponse
    {
        [JsonPropertyName("companies")]
        public List<Company> Companies { get; set; } = new();

        [JsonPropertyName("total_count")]
        public int TotalCount { get; set; }
    }

    public class FinancialData
    {
        [JsonPropertyName("company_name")]
        public string CompanyName { get; set; } = string.Empty;

        [JsonPropertyName("financial_summary")]
        public Dictionary<string, string>? FinancialSummary { get; set; }

        [JsonPropertyName("financial_chunks")]
        public object? FinancialChunks { get; set; }

        [JsonPropertyName("context")]
        public List<QueryResult>? Context { get; set; }
    }
}