class ConversationService {
  constructor() {
    this.conversations = new Map();
  }

  getConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, []);
    }
    return this.conversations.get(conversationId);
  }

  updateConversation(conversationId, messages) {
    // Keep only the last 20 messages to prevent context from getting too large
    const limitedMessages = messages.slice(-20);
    this.conversations.set(conversationId, limitedMessages);
  }

  addMessageToConversation(conversationId, message) {
    const conversation = this.getConversation(conversationId);
    conversation.push(message);
    this.updateConversation(conversationId, conversation);
  }

  clearConversation(conversationId) {
    this.conversations.delete(conversationId);
  }

  getAllConversationIds() {
    return Array.from(this.conversations.keys());
  }
}

export default new ConversationService();