using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using SemanticKernelAgent.Agents;

namespace SemanticKernelAgent
{
    class Program
    {
        static async Task Main(string[] args)
        {
            // Load configuration
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false)
                .Build();

            // Setup dependency injection
            var services = new ServiceCollection();
            services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Warning));
            services.AddHttpClient();

            var serviceProvider = services.BuildServiceProvider();
            var loggerFactory = serviceProvider.GetRequiredService<ILoggerFactory>();
            var httpClientFactory = serviceProvider.GetRequiredService<IHttpClientFactory>();

            // Get configuration values
            var openAiApiKey = configuration["OpenAI:ApiKey"] ?? 
                               Environment.GetEnvironmentVariable("OPENAI_API_KEY") ??
                               throw new InvalidOperationException("OpenAI API key not found in configuration or environment variables.");

            var vectorDbUrl = configuration["VectorDatabase:BaseUrl"] ?? "http://localhost:3000";

            // Create kernel
            var kernelBuilder = Kernel.CreateBuilder();
            kernelBuilder.AddOpenAIChatCompletion(
                modelId: "gpt-4o-mini",
                apiKey: openAiApiKey);
            kernelBuilder.Services.AddLogging(c => c.AddConsole().SetMinimumLevel(LogLevel.Warning));

            var kernel = kernelBuilder.Build();

            // Create HTTP client for vector database
            var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            // Create the 10K data agent
            var agent = new TenKDataAgent(kernel, httpClient, vectorDbUrl);

            // Handle command line arguments
            if (args.Length > 0)
            {
                // Single query mode
                var query = string.Join(" ", args);
                Console.WriteLine($"Query: {query}");
                Console.WriteLine("Response:");
                var response = await agent.ChatAsync(query);
                Console.WriteLine(response);
            }
            else
            {
                // Interactive mode
                await agent.StartInteractiveChatAsync();
            }
        }
    }
}