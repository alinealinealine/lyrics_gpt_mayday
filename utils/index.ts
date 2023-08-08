import { OpenAIModel } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const OpenAIStream = async (prompt: string, apiKey: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    method: "POST",
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers queries，do similarity or exact search， using the lyrics from My Little Airport band's songs. Use the text provided to form your answer. Try to use your own words when possible. Be poetic, concise, and clear, answer first in Chinese then translate it to English. Keep your answer less than 250 words for both the Chinese and English answers."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens:500,
      temperature: 0.0,
      stream: true
    })
  });

  if (res.status !== 200) {
    const errorDetails = await res.text(); // or res.json() if the error is in JSON format
    console.error('OpenAI API error details:', errorDetails);
    throw new Error("OpenAI API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
