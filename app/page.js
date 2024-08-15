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

  const sendMessage = async () => {
    setQuery('');
    setYoutubeUrl('');
    setMessages((messages) => [
      ...messages,
      { role: 'user', content: query },
      { role: 'assistant', content: `` }
    ]);

    const response = fetch('http://127.0.0.1:8000/perform_rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: youtubeUrl, query: query }),
    }).then((response) => {
      if (response.headers.get('content-type').includes('application/json')) {
          return response.json();
      }else {
        throw new Error('Response is not JSON');
      }
    }).then((data) => {
      setMessages((messages) => {
        const updatedMessages = [...messages]
        updatedMessages[updatedMessages.length - 1].content = data
        return updatedMessages
      });
    }).catch(error => console.error('Error:', error));
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
          <TextField
            label="YouTube URL"
            fullWidth
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
          <TextField
            label="Question"
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="contained" onClick={sendMessage}>Send</Button>
        </Stack>

      </Stack>
    </Box>
  );
}

