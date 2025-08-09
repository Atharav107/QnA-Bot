import OpenAI from "openai";
import readline from "readline";

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion() {
  return new Promise((resolve) => {
    rl.question("\nEnter your question (or type 'exit' to quit): ", (question) => {
      resolve(question);
    });
  });
}

async function getAnswer(question) {
  const client = new OpenAI({ baseURL: endpoint, apiKey: token });

  console.log("\nThinking...");
  
  const response = await client.chat.completions.create({
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: question }
    ],
    temperature: 1,
    top_p: 1,
    model: model
  });

  return response.choices[0].message.content;
}

export async function main() {
  console.log("Welcome to the Q&A Assistant! Ask anything you'd like to know.");
  
  while (true) {
    const question = await askQuestion();
    
    if (question.toLowerCase() === 'exit') {
      console.log("Goodbye!");
      rl.close();
      break;
    }
    
    try {
      const answer = await getAnswer(question);
      console.log("\nAnswer:", answer);
    } catch (err) {
      console.error("Error:", err.message);
    }
  }
}

main().catch((err) => {
  console.error("The application encountered an error:", err);
  rl.close();
});

