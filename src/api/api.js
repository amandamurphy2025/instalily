export const getAIMessage = async (userQuery) => {
  try {
    const response = await fetch('http://localhost:3001/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userQuery }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const data = await response.json();

    return {
      role: "assistant",
      content: data.reply,
      partData: data.partData || null
    };
  } catch (error) {
    console.error("Error fetching AI message:", error);
    return {
      role: "assistant",
      content: "Sorry, I couldn't connect to the AI service. Please try again in a moment."
    };
  }
};