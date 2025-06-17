using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using SemanticKernelAgent.Plugins;

namespace SemanticKernelAgent.Agents
{
    public class TenKDataAgent
    {
        private readonly Kernel _kernel;
        private readonly ChatCompletionAgent _agent;

        public TenKDataAgent(Kernel kernel, HttpClient httpClient, string vectorDbBaseUrl = "http://localhost:3000")
        {
            _kernel = kernel;

            // Add the vector database plugin
            _kernel.Plugins.AddFromObject(new VectorDatabasePlugin(httpClient, vectorDbBaseUrl));

            // Define the system prompt for the 10K data agent
            var systemPrompt = @"
You are a specialized financial analyst assistant focused on providing information from SEC 10K filings and business documents.

**Your Role:**
- Help users find and analyze information from 10K filings and business documents
- Provide accurate financial data, business insights, and risk assessments
- Explain complex financial concepts in clear, understandable terms

**Your Capabilities:**
- Search through 10K documents using natural language queries
- Extract and summarize financial metrics (revenue, profit, assets, etc.)
- Identify business risks and competitive factors
- Compare financial performance across companies
- Provide business strategy insights from filing documents

**Guidelines:**
- Always cite the specific company and document section when providing information
- Be precise with financial figures and include proper context
- If information is not available in the database, clearly state this limitation
- Suggest alternative queries if the current search doesn't yield results
- Focus on factual, document-based information rather than speculation

**Response Format:**
- Start with a clear, direct answer to the user's question
- Provide supporting details from the 10K documents
- Include relevant financial metrics when applicable
- Suggest follow-up questions or related areas of interest

Remember: Your knowledge comes from the ingested 10K documents in the vector database. Always use the available search functions to find current, accurate information rather than relying on general knowledge.
";

            // Create the chat completion agent
            _agent = new ChatCompletionAgent()
            {
                Instructions = systemPrompt,
                Name = "TenKDataAgent",
                Kernel = _kernel,
                Arguments = new KernelArguments(new OpenAIPromptExecutionSettings()
                {
                    ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
                    Temperature = 0.1, // Lower temperature for more factual responses
                    MaxTokens = 2000
                })
            };
        }

        public async Task<string> ChatAsync(string userMessage, CancellationToken cancellationToken = default)
        {
            try
            {
                // Create a new chat history for this interaction
                var chatHistory = new ChatHistory();
                chatHistory.AddUserMessage(userMessage);

                // Get response from the agent
                await foreach (ChatMessageContent message in _agent.InvokeAsync(chatHistory, cancellationToken: cancellationToken))
                {
                    return message.Content ?? "No response generated.";
                }

                return "No response generated.";
            }
            catch (Exception ex)
            {
                return $"Error processing request: {ex.Message}";
            }
        }

        public async Task StartInteractiveChatAsync()
        {
            Console.WriteLine("=== 10K Data Analysis Agent ===");
            Console.WriteLine("I can help you analyze SEC 10K filings and business documents.");
            Console.WriteLine("Ask me about company financials, business risks, revenue data, and more!");
            Console.WriteLine("Type 'quit' to exit.\n");

            var chatHistory = new ChatHistory();

            while (true)
            {
                Console.Write("You: ");
                var userInput = Console.ReadLine();

                if (string.IsNullOrWhiteSpace(userInput))
                    continue;

                if (userInput.ToLower() is "quit" or "exit" or "bye")
                {
                    Console.WriteLine("Agent: Goodbye! Feel free to return anytime for 10K data analysis.");
                    break;
                }

                Console.Write("Agent: ");

                try
                {
                    chatHistory.AddUserMessage(userInput);

                    var response = string.Empty;
                    await foreach (ChatMessageContent message in _agent.InvokeAsync(chatHistory))
                    {
                        Console.Write(message.Content);
                        response += message.Content;
                    }

                    chatHistory.AddAssistantMessage(response);
                    Console.WriteLine("\n");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error: {ex.Message}\n");
                }
            }
        }
    }
}

