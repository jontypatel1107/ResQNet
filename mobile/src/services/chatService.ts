import { api } from "./api";
import { ChatMessage } from "../types";

export interface ParticipantInfo {
  id: string;
  name: string;
  phone?: string | null;
  verified?: boolean;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  citizen?: ParticipantInfo | null;
  volunteer?: ParticipantInfo | null;
}

export const chatService = {
  async getMessages(emergencyId: string): Promise<ChatHistoryResponse> {
    const res = await api.get(`/emergencies/${emergencyId}/messages`);
    if (res.data?.success && res.data.data) {
      return {
        messages: Array.isArray(res.data.data.messages) ? res.data.data.messages : [],
        citizen: res.data.data.citizen || null,
        volunteer: res.data.data.volunteer || null,
      };
    }
    return { messages: [], citizen: null, volunteer: null };
  },

  async sendMessage(
    emergencyId: string,
    message: string,
    isQuickReply: boolean = false
  ): Promise<ChatMessage | null> {
    const res = await api.post(`/emergencies/${emergencyId}/messages`, {
      message,
      isQuickReply,
    });
    if (res.data?.success && res.data.data?.message) {
      return res.data.data.message;
    }
    return null;
  },
};
