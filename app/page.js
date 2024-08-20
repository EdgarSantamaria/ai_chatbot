'use client'
import { Box, Stack, TextField, Button } from "@mui/material";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello I am your AI Assistant. Give me a YouTube URL and a question and I will generate a response for you.`,
    }
  ]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [query, setQuery] = useState('');
  const [isVideo, setisVideo] = useState(false);
  const [message, setMessage] = useState('');
  const sendMessage = async () => {
    setQuery('');
    setisVideo(true);
    setMessages((messages) => [
      ...messages,
      { role: 'user', content: query },
      { role: 'assistant', content: `` }
    ]);

    console.log("Sending URL:", youtubeUrl);
    console.log("Sending Query:", query);
    
    try {
      const response = await fetch('https://api-rag-five.vercel.app/perform_rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: youtubeUrl, query: query }),
      });
  
      if (!response.body) {
        throw new Error('No response body');
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';
  
      const processText = async ({ done, value }) => {
        if (done) {
          return result;
        }
  
        const text = decoder.decode(value || new Int8Array(), { stream: true });
        result += text;
  
        setMessages((messages) => {
          const lastMessage = messages[messages.length - 1];
          const otherMessages = messages.slice(0, messages.length - 1);
          return [
            ...otherMessages,
            {
              ...lastMessage,
              content: lastMessage.content + text,
            },
          ];
        });
  
        return reader.read().then(processText);
      };
  
      await reader.read().then(processText);
  
    } catch (error) {
      console.error('Error:', error);
      setMessages((messages) => {
        const updatedMessages = [...messages];
        updatedMessages[updatedMessages.length - 1].content = 'An error occurred. Please try again.';
        return updatedMessages;
      });
    }
  }

  const resetVideo = async () => {
    setisVideo(false)
    setYoutubeUrl('')
    setMessages([
      { role: 'assistant', content: `Enter a new video.` }
    ])
  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >

      <Stack
        width="600px"
        height="800px"
        direction="column"
        border="1px solid black"
        p={2}
        spacing={2}
      >

        <Stack
          direction="column"
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >

          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={message.role === 'assistant' ? 'flex-start' : 'flex-end'}
            >
              <Box
                bgcolor={message.role === 'assistant' ? 'primary.main' : 'secondary.main'}
                color="white"
                p={3}
                borderRadius={16}
                sx={{whiteSpace: "pre-wrap"}}
              >
                {message.content}
              </Box>
            </Box>
          ))}
        </Stack>

        <Stack direction="column" spacing={2}>
          {!isVideo &&(<TextField
            label="YouTube URL"
            fullWidth
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />)}
          
          <TextField
            label="Question"
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="contained" onClick={sendMessage}>Send</Button>
          <Button variant="contained" onClick={resetVideo}>
            Reset Video
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}