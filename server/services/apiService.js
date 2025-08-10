import OpenAI from 'openai';

class ApiService {
  constructor() {
    this.openaiClient = null;
  }

  initialize(token, endpoint, model) {
    this.token = token;
    this.endpoint = endpoint;
    this.model = model;
    
    this.openaiClient = new OpenAI({
      baseURL: this.endpoint,
      apiKey: this.token
    });
  }

  async getCompletion(messages, options = {}) {
    if (!this.openaiClient) {
      throw new Error('API client not initialized');
    }

    const defaultOptions = {
      temperature: 1,
      top_p: 1,
      model: this.model
    };

    const response = await this.openaiClient.chat.completions.create({
      messages,
      ...defaultOptions,
      ...options
    });

    return response;
  }
}

export default new ApiService();