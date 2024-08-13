import { NextResponse } from "next/server"
import OpenAI from "openai"

const systemPrompt = "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.";

export async function POST(req){
    const openai = new OpenAI();
    const data = await req.json();

    const completion = await openai.chat.completions.create({
        messages:
        [{role: "system", content: systemPrompt,},...data,],
        
        model: 'gpt-4o-mini',
        stream: true
    })

    const stream = new ReadableStream({
        async start(controller){
            const encoder = new TextEncoder();
            try{
                for await (const chunk of completion){
                    const content = chunk.choices[0]?.delta?.content
                    if(content){
                        const text = encoder.encode(content);
                        controller.enqueue(text);
                    }
                }
            }
            catch(err){
                controller.error(err);
            } finally{
                controller.close();
            }
        }
    })
    return new NextResponse(stream)
}