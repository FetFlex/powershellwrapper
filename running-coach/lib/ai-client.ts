// AI provider abstraction - switch between Claude and Gemini via AI_PROVIDER env var
// Set AI_PROVIDER=claude + ANTHROPIC_API_KEY, or AI_PROVIDER=gemini + GOOGLE_AI_KEY

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIClient {
  chat(messages: AIMessage[], systemPrompt: string): Promise<string>
}

class ClaudeClient implements AIClient {
  async chat(messages: AIMessage[], systemPrompt: string): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })

    return (response.content[0] as { type: string; text: string }).text
  }
}

class GeminiClient implements AIClient {
  async chat(messages: AIMessage[], systemPrompt: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!)

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
    })

    // Gemini uses alternating user/model turns - merge into history + last message
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage.content)
    return result.response.text()
  }
}

class NoOpClient implements AIClient {
  async chat(): Promise<string> {
    return 'AI-coaching er ikke tilgængeligt. Tilføj ANTHROPIC_API_KEY eller GOOGLE_AI_KEY i din .env fil for at aktivere denne funktion.'
  }
}

export function getAIClient(): AIClient {
  const provider = process.env.AI_PROVIDER ?? 'auto'

  if (provider === 'gemini' || (provider === 'auto' && process.env.GOOGLE_AI_KEY)) {
    if (!process.env.GOOGLE_AI_KEY) throw new Error('GOOGLE_AI_KEY mangler')
    return new GeminiClient()
  }

  if (provider === 'claude' || (provider === 'auto' && process.env.ANTHROPIC_API_KEY)) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY mangler')
    return new ClaudeClient()
  }

  return new NoOpClient()
}

export function isAIAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_KEY)
}
